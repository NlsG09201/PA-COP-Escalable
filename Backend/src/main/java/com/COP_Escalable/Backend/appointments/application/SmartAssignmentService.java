package com.COP_Escalable.Backend.appointments.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentAssignmentAudit;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentAssignmentAuditRepository;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.appointments.infrastructure.ProfessionalLoadRow;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.ProfessionalStatus;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SmartAssignmentService {
	private static final int MAX_DAILY_APPOINTMENTS_PER_PROFESSIONAL = 12;
	private static final int SLOT_STEP_MINUTES = 30;
	private static final int MAX_ALTERNATIVES = 3;

	private final ProfessionalRepository professionals;
	private final AppointmentRepository appointments;
	private final AppointmentService appointmentService;
	private final AppointmentAssignmentAuditRepository auditRepository;

	public SmartAssignmentService(
			ProfessionalRepository professionals,
			AppointmentRepository appointments,
			AppointmentService appointmentService,
			AppointmentAssignmentAuditRepository auditRepository
	) {
		this.professionals = professionals;
		this.appointments = appointments;
		this.appointmentService = appointmentService;
		this.auditRepository = auditRepository;
	}

	@Transactional(readOnly = true)
	public AssignmentRecommendation recommend(AssignmentRequest request) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		validateWindow(request.startAt(), request.endAt());

		var candidates = professionals.findAllByOrganizationIdAndDefaultSiteIdAndStatus(
				ctx.organizationId(),
				ctx.siteId(),
				ProfessionalStatus.ACTIVE
		).stream()
				.filter(p -> matchesType(p, request.appointmentType()))
				.toList();

		if (candidates.isEmpty()) {
			throw new IllegalArgumentException("No professionals available for requested appointment type");
		}

		var now = Instant.now();
		var loadFrom = now.minus(Duration.ofDays(7));
		var loadTo = now.plus(Duration.ofDays(30));
		Map<UUID, Long> workload = appointments.countLoadByProfessional(ctx.organizationId(), ctx.siteId(), loadFrom, loadTo).stream()
				.collect(Collectors.toMap(ProfessionalLoadRow::professionalId, ProfessionalLoadRow::total));
		long maxLoad = Math.max(1L, workload.values().stream().mapToLong(v -> v).max().orElse(1L));

		var scored = candidates.stream()
				.map(p -> toCandidateScore(p, request, workload.getOrDefault(p.getId(), 0L), maxLoad))
				.filter(c -> c.available())
				.sorted(Comparator
						.comparingDouble(AssignmentCandidate::score).reversed()
						.thenComparing(AssignmentCandidate::workload7d)
						.thenComparing(AssignmentCandidate::professionalId))
				.toList();

		List<AlternativeSlot> alternatives = scored.isEmpty() ? buildAlternatives(candidates, request, ctx.organizationId(), ctx.siteId()) : List.of();
		AssignmentRecommendation rec = scored.isEmpty()
				? new AssignmentRecommendation(null, List.of(), alternatives)
				: new AssignmentRecommendation(scored.get(0), scored, alternatives);
		persistAudit(ctx.organizationId(), ctx.siteId(), request, rec, scored.isEmpty() ? "NO_AVAILABILITY" : "RECOMMENDED");
		if (scored.isEmpty()) throw new IllegalArgumentException("No available professionals for requested time window");
		return rec;
	}

	@Transactional
	public Appointment autoAssignAndRequest(AssignmentRequest request) {
		var recommendation = recommend(request);
		var ordered = recommendation.candidates();
		IllegalArgumentException last = null;
		for (var c : ordered) {
			try {
				var saved = appointmentService.request(
						c.professionalId(),
						request.patientId(),
						request.startAt(),
						request.endAt(),
						request.reason(),
						request.serviceOfferingId(),
						request.serviceNameSnapshot(),
						request.serviceCategorySnapshot()
				);
				persistAudit(
						TenantContextHolder.require().organizationId(),
						TenantContextHolder.require().siteId(),
						request,
						new AssignmentRecommendation(c, ordered, List.of()),
						"AUTO_ASSIGNED"
				);
				return saved;
			} catch (IllegalArgumentException ex) {
				last = ex;
			}
		}
		persistAudit(
				TenantContextHolder.require().organizationId(),
				TenantContextHolder.require().siteId(),
				request,
				new AssignmentRecommendation(null, ordered, List.of()),
				"AUTO_ASSIGNMENT_FAILED"
		);
		throw last != null ? last : new IllegalArgumentException("Unable to assign appointment");
	}

	private AssignmentCandidate toCandidateScore(
			Professional professional,
			AssignmentRequest request,
			long workload7d,
			long maxLoad
	) {
		boolean overlap = appointments.existsOverlapping(
				professional.getOrganizationId(),
				professional.getDefaultSiteId(),
				professional.getId(),
				request.startAt(),
				request.endAt()
		);
		if (overlap) {
			return AssignmentCandidate.unavailable(professional, workload7d, "Overlapping appointment");
		}
		Instant dayStart = request.startAt().atZone(ZoneOffset.UTC).truncatedTo(ChronoUnit.DAYS).toInstant();
		Instant dayEnd = dayStart.plus(1, ChronoUnit.DAYS);
		long dayLoad = appointments.countProfessionalDayLoad(
				professional.getOrganizationId(),
				professional.getDefaultSiteId(),
				professional.getId(),
				dayStart,
				dayEnd
		);
		if (dayLoad >= MAX_DAILY_APPOINTMENTS_PER_PROFESSIONAL) {
			return AssignmentCandidate.unavailable(professional, workload7d, "Daily capacity reached");
		}

		double loadComponent = 1.0 - ((double) workload7d / (double) maxLoad);
		double urgencyComponent = urgencyWeight(request.priority());
		double continuityComponent = request.preferredProfessionalId() != null
				&& request.preferredProfessionalId().equals(professional.getId()) ? 1.0 : 0.0;
		double waitingMinutes = Math.max(0, Duration.between(Instant.now(), request.startAt()).toMinutes());
		double waitComponent = 1.0 / (1.0 + (waitingMinutes / 120.0));

		double score = (0.45 * loadComponent) + (0.25 * urgencyComponent) + (0.20 * continuityComponent) + (0.10 * waitComponent);
		return new AssignmentCandidate(
				professional.getId(),
				professional.getFullName(),
				professional.getSpecialty(),
				workload7d,
				true,
				score,
				"load=" + String.format(Locale.ROOT, "%.2f", loadComponent)
						+ ", urgency=" + String.format(Locale.ROOT, "%.2f", urgencyComponent)
						+ ", continuity=" + String.format(Locale.ROOT, "%.2f", continuityComponent)
		);
	}

	private List<AlternativeSlot> buildAlternatives(List<Professional> candidates, AssignmentRequest request, UUID organizationId, UUID siteId) {
		long durationMinutes = Math.max(15, Duration.between(request.startAt(), request.endAt()).toMinutes());
		var alternatives = new java.util.ArrayList<AlternativeSlot>();
		for (int step = 1; step <= 20 && alternatives.size() < MAX_ALTERNATIVES; step++) {
			Instant altStart = request.startAt().plus(step * SLOT_STEP_MINUTES, ChronoUnit.MINUTES);
			Instant altEnd = altStart.plus(durationMinutes, ChronoUnit.MINUTES);
			for (var p : candidates) {
				if (appointments.existsOverlapping(organizationId, siteId, p.getId(), altStart, altEnd)) continue;
				alternatives.add(new AlternativeSlot(altStart, altEnd, p.getId(), p.getFullName()));
				if (alternatives.size() >= MAX_ALTERNATIVES) break;
			}
		}
		return alternatives;
	}

	private void persistAudit(UUID organizationId, UUID siteId, AssignmentRequest request, AssignmentRecommendation rec, String outcome) {
		String candidates = rec.candidates() == null ? "[]" : rec.candidates().stream()
				.map(c -> c.professionalId() + ":" + String.format(Locale.ROOT, "%.3f", c.score()))
				.collect(Collectors.joining(",", "[", "]"));
		String alternatives = rec.alternatives() == null ? "[]" : rec.alternatives().stream()
				.map(a -> a.professionalId() + "@" + a.startAt())
				.collect(Collectors.joining(",", "[", "]"));
		var audit = AppointmentAssignmentAudit.of(
				organizationId,
				siteId,
				request.patientId(),
				request.appointmentType().name(),
				request.priority().name(),
				request.startAt(),
				request.endAt(),
				rec.winner() == null ? null : rec.winner().professionalId(),
				rec.winner() == null ? null : rec.winner().score(),
				candidates,
				alternatives,
				outcome
		);
		auditRepository.save(audit);
	}

	private static void validateWindow(Instant startAt, Instant endAt) {
		if (startAt == null || endAt == null) throw new IllegalArgumentException("startAt/endAt are required");
		if (!endAt.isAfter(startAt)) throw new IllegalArgumentException("endAt must be after startAt");
	}

	private static boolean matchesType(Professional p, AppointmentType type) {
		String specialty = p.getSpecialty() == null ? "" : p.getSpecialty().toLowerCase(Locale.ROOT);
		return switch (type) {
			case ORTODONCIA -> specialty.contains("orto") || specialty.contains("odon") || specialty.contains("dent");
			case PSICOLOGIA -> specialty.contains("psico") || specialty.contains("psych");
		};
	}

	private static double urgencyWeight(AppointmentPriority priority) {
		return switch (priority) {
			case CRITICAL -> 1.0;
			case HIGH -> 0.8;
			case NORMAL -> 0.5;
			case LOW -> 0.3;
		};
	}

	public enum AppointmentType {
		ORTODONCIA, PSICOLOGIA
	}

	public enum AppointmentPriority {
		LOW, NORMAL, HIGH, CRITICAL
	}

	public record AssignmentRequest(
			UUID patientId,
			AppointmentType appointmentType,
			Instant startAt,
			Instant endAt,
			AppointmentPriority priority,
			UUID preferredProfessionalId,
			String reason,
			UUID serviceOfferingId,
			String serviceNameSnapshot,
			String serviceCategorySnapshot
	) {}

	public record AssignmentCandidate(
			UUID professionalId,
			String professionalName,
			String specialty,
			long workload7d,
			boolean available,
			double score,
			String rationale
	) {
		static AssignmentCandidate unavailable(Professional p, long workload, String rationale) {
			return new AssignmentCandidate(p.getId(), p.getFullName(), p.getSpecialty(), workload, false, -1.0, rationale);
		}
	}

	public record AssignmentRecommendation(
			AssignmentCandidate winner,
			List<AssignmentCandidate> candidates,
			List<AlternativeSlot> alternatives
	) {}

	public record AlternativeSlot(
			Instant startAt,
			Instant endAt,
			UUID professionalId,
			String professionalName
	) {}
}
