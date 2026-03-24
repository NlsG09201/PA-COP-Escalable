package com.COP_Escalable.Backend.portal.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import com.COP_Escalable.Backend.clinical.infrastructure.ClinicalRecordRepository;
import com.COP_Escalable.Backend.odontology.domain.TreatmentPlan;
import com.COP_Escalable.Backend.odontology.infrastructure.TreatmentPlanRepository;
import com.COP_Escalable.Backend.portal.domain.PortalAccessToken;
import com.COP_Escalable.Backend.portal.infrastructure.PortalAccessTokenRepository;
import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import com.COP_Escalable.Backend.psychology.infrastructure.PsychologicalSnapshotRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PortalService {

	private static final SecureRandom SECURE_RANDOM = new SecureRandom();
	private static final int TOKEN_BYTES = 32;
	private static final long TOKEN_VALIDITY_DAYS = 30;

	private final PortalAccessTokenRepository tokenRepository;
	private final ClinicalRecordRepository clinicalRecordRepository;
	private final TreatmentPlanRepository treatmentPlanRepository;
	private final AppointmentRepository appointmentRepository;
	private final PsychologicalSnapshotRepository snapshotRepository;

	public PortalService(PortalAccessTokenRepository tokenRepository,
						 ClinicalRecordRepository clinicalRecordRepository,
						 TreatmentPlanRepository treatmentPlanRepository,
						 AppointmentRepository appointmentRepository,
						 PsychologicalSnapshotRepository snapshotRepository) {
		this.tokenRepository = tokenRepository;
		this.clinicalRecordRepository = clinicalRecordRepository;
		this.treatmentPlanRepository = treatmentPlanRepository;
		this.appointmentRepository = appointmentRepository;
		this.snapshotRepository = snapshotRepository;
	}

	@Transactional
	public String generateAccessToken(UUID patientId) {
		byte[] tokenBytes = new byte[TOKEN_BYTES];
		SECURE_RANDOM.nextBytes(tokenBytes);
		String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

		String hash = sha256Hex(rawToken);
		Instant expiresAt = Instant.now().plus(TOKEN_VALIDITY_DAYS, ChronoUnit.DAYS);

		PortalAccessToken token = PortalAccessToken.create(patientId, hash, expiresAt);
		tokenRepository.save(token);
		return rawToken;
	}

	@Transactional
	public UUID validateToken(String rawToken) {
		String hash = sha256Hex(rawToken);
		PortalAccessToken token = tokenRepository.findByTokenHashAndActiveTrue(hash)
				.orElseThrow(() -> new IllegalArgumentException("Invalid or expired token"));

		if (token.isExpired()) {
			token.revoke();
			tokenRepository.save(token);
			throw new IllegalArgumentException("Token has expired");
		}

		token.recordUsage();
		tokenRepository.save(token);
		return token.getPatientId();
	}

	@Transactional
	public void revokeToken(UUID tokenId) {
		PortalAccessToken token = tokenRepository.findById(tokenId)
				.orElseThrow(() -> new IllegalArgumentException("Token not found"));
		token.revoke();
		tokenRepository.save(token);
	}

	@Transactional(readOnly = true)
	public PortalDashboardResponse getPatientDashboard(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		var clinicalSummary = buildClinicalSummary(orgId, siteId, patientId);
		var treatmentPlans = buildTreatmentPlanViews(orgId, siteId, patientId);
		var appointments = buildAppointmentViews(orgId, siteId, patientId);
		var psychEvolution = buildPsychologicalEvolution(orgId, siteId, patientId);

		return new PortalDashboardResponse(
				patientId, clinicalSummary, treatmentPlans, appointments, psychEvolution);
	}

	@Transactional(readOnly = true)
	public List<PortalDashboardResponse.EntryView> getPatientTimeline(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var record = clinicalRecordRepository.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByUpdatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId);

		if (record.isEmpty()) {
			return Collections.emptyList();
		}

		return record.get().getEntries().stream()
				.sorted(Comparator.comparing(ClinicalRecord.Entry::at).reversed())
				.map(e -> new PortalDashboardResponse.EntryView(e.at(), e.type(), e.note()))
				.toList();
	}

	private PortalDashboardResponse.ClinicalSummary buildClinicalSummary(UUID orgId, UUID siteId, UUID patientId) {
		var recordOpt = clinicalRecordRepository
				.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByUpdatedAtDesc(orgId, siteId, patientId);

		if (recordOpt.isEmpty()) {
			return new PortalDashboardResponse.ClinicalSummary(null, null, Collections.emptyList());
		}

		ClinicalRecord record = recordOpt.get();
		var entries = record.getEntries();
		int limit = Math.min(entries.size(), 5);
		List<PortalDashboardResponse.EntryView> recentEntries = new ArrayList<>();
		for (int i = entries.size() - limit; i < entries.size(); i++) {
			var e = entries.get(i);
			recentEntries.add(new PortalDashboardResponse.EntryView(e.at(), e.type(), e.note()));
		}

		return new PortalDashboardResponse.ClinicalSummary(record.getId(), record.getUpdatedAt(), recentEntries);
	}

	private List<PortalDashboardResponse.TreatmentPlanView> buildTreatmentPlanViews(UUID orgId, UUID siteId, UUID patientId) {
		var plans = treatmentPlanRepository
				.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		return plans.stream()
				.filter(p -> "ACTIVE".equals(p.getStatus()) || "DRAFT".equals(p.getStatus()))
				.map(p -> {
					int total = p.getSteps().size();
					int completed = (int) p.getSteps().stream()
							.filter(TreatmentPlan.TreatmentStep::isCompleted).count();
					return new PortalDashboardResponse.TreatmentPlanView(
							p.getId(), p.getName(), p.getStatus(), total, completed, p.getCreatedAt());
				}).toList();
	}

	private List<PortalDashboardResponse.AppointmentView> buildAppointmentViews(UUID orgId, UUID siteId, UUID patientId) {
		Instant now = Instant.now();
		Instant futureLimit = now.plus(90, ChronoUnit.DAYS);

		var allAppointments = appointmentRepository
				.findAllByOrganizationIdAndSiteIdAndStartAtBetween(orgId, siteId, now, futureLimit);

		return allAppointments.stream()
				.filter(a -> a.getPatientId().equals(patientId))
				.sorted(Comparator.comparing(Appointment::getStartAt))
				.limit(10)
				.map(a -> new PortalDashboardResponse.AppointmentView(
						a.getId(), a.getStartAt(), a.getEndAt(),
						a.getStatus().name(), a.getReason(), a.getServiceNameSnapshot()))
				.toList();
	}

	private PortalDashboardResponse.PsychologicalEvolutionView buildPsychologicalEvolution(
			UUID orgId, UUID siteId, UUID patientId) {
		var snapshots = snapshotRepository
				.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByOccurredAtDesc(orgId, siteId, patientId);

		if (snapshots.isEmpty()) {
			return new PortalDashboardResponse.PsychologicalEvolutionView(0, Map.of(), null, null);
		}

		PsychologicalSnapshot latest = snapshots.getFirst();
		return new PortalDashboardResponse.PsychologicalEvolutionView(
				snapshots.size(),
				latest.getMetrics() != null ? latest.getMetrics() : Map.of(),
				latest.getPredominantSentiment(),
				latest.getSentimentScore()
		);
	}

	private static String sha256Hex(String input) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		} catch (Exception e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}
}
