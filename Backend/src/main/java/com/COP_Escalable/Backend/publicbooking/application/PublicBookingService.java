package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.patients.domain.Patient;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicBookingRepository;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicNotificationLogRepository;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicPaymentRepository;
import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.ProfessionalStatus;
import com.COP_Escalable.Backend.tenancy.domain.Site;
import com.COP_Escalable.Backend.tenancy.domain.SiteStatus;
import com.COP_Escalable.Backend.catalog.application.PublishedCatalogService;
import com.COP_Escalable.Backend.catalog.application.PublishedOfferingView;
import com.COP_Escalable.Backend.patients.application.PatientRegisteredEvent;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class PublicBookingService {
	private static final int SLOT_WINDOW_DAYS = 7;
	private static final int HOLD_MINUTES = 15;

	private final SiteRepository sites;
	private final ProfessionalRepository professionals;
	private final PatientRepository patients;
	private final AppointmentRepository appointments;
	private final PublicBookingRepository bookings;
	private final PublicPaymentRepository payments;
	private final PublicPaymentService paymentService;
	private final PublicNotificationLogRepository notificationLogs;
	private final PublicBookingNotificationService notificationService;
	private final ApplicationEventPublisher eventPublisher;
	private final PublishedCatalogService publishedCatalog;

	public PublicBookingService(
			SiteRepository sites,
			ProfessionalRepository professionals,
			PatientRepository patients,
			AppointmentRepository appointments,
			PublicBookingRepository bookings,
			PublicPaymentRepository payments,
			PublicPaymentService paymentService,
			PublicNotificationLogRepository notificationLogs,
			PublicBookingNotificationService notificationService,
			ApplicationEventPublisher eventPublisher,
			PublishedCatalogService publishedCatalog
	) {
		this.sites = sites;
		this.professionals = professionals;
		this.patients = patients;
		this.appointments = appointments;
		this.bookings = bookings;
		this.payments = payments;
		this.paymentService = paymentService;
		this.notificationLogs = notificationLogs;
		this.notificationService = notificationService;
		this.eventPublisher = eventPublisher;
		this.publishedCatalog = publishedCatalog;
	}

	@Transactional(readOnly = true)
	public List<ServiceSummary> listCatalog(UUID siteId) {
		if (siteId == null) {
			return List.of();
		}
		var site = requireSite(siteId);
		return publishedCatalog.listPublishedForSite(site.getOrganizationId(), siteId).stream()
				.map(def -> new ServiceSummary(
						def.publicId(),
						def.categoryDisplayName(),
						def.title(),
						def.description(),
						def.durationMinutes(),
						def.basePrice(),
						def.promoPrice(),
						def.badge(),
						def.features(),
						resolvePrice(def)
				))
				.toList();
	}

	@Transactional(readOnly = true)
	public AvailabilitySummary getAvailability(UUID siteId, String serviceId, LocalDate fromDate) {
		var site = requireSite(siteId);
		var definition = requireOffering(site, serviceId);
		var zoneId = ZoneId.of(site.getTimezone());
		var professionalsForService = eligibleProfessionals(site, definition);
		var slots = new ArrayList<AvailabilitySlot>();

		if (professionalsForService.isEmpty()) {
			return new AvailabilitySummary(siteId, serviceId, List.of());
		}

		var dayCursor = fromDate == null ? LocalDate.now(zoneId) : fromDate;
		var now = Instant.now();

		for (int dayOffset = 0; dayOffset < SLOT_WINDOW_DAYS && slots.size() < 24; dayOffset++) {
			var currentDate = dayCursor.plusDays(dayOffset);
			for (LocalTime time = LocalTime.of(9, 0); !time.plusMinutes(definition.durationMinutes()).isAfter(LocalTime.of(18, 0)); time = time.plusMinutes(30)) {
				var slotStart = ZonedDateTime.of(currentDate, time, zoneId).toInstant();
				var slotEnd = slotStart.plusSeconds(definition.durationMinutes() * 60L);
				if (!slotStart.isAfter(now.plusSeconds(1800))) {
					continue;
				}

				var professional = firstAvailableProfessional(site, professionalsForService, slotStart, slotEnd, now);
				if (professional.isPresent()) {
					slots.add(new AvailabilitySlot(
							slotStart,
							slotEnd,
							professional.get().getId(),
							professional.get().getFullName()
					));
				}
			}
		}

		return new AvailabilitySummary(siteId, serviceId, slots);
	}

	@Transactional(readOnly = true)
	public QuoteSummary quoteBooking(QuoteBookingCommand command) {
		var resolved = resolveQuotedSlot(command.siteId(), command.serviceId(), command.slotStartAt(), Instant.now());
		return toQuoteSummary(resolved);
	}

	@Transactional
	public BookingSummary createBooking(CreateBookingCommand command) {
		var now = Instant.now();
		var resolved = resolveQuotedSlot(command.siteId(), command.serviceId(), command.slotStartAt(), now);
		var zoneId = ZoneId.of(resolved.site().getTimezone());

		var booking = PublicBooking.createPendingPayment(
				resolved.site().getOrganizationId(),
				resolved.site().getId(),
				resolved.definition().publicId(),
				resolved.definition().title(),
				resolved.definition().categoryDisplayName(),
				command.patientName(),
				command.email(),
				command.phone(),
				command.notes(),
				resolvePrice(resolved.definition()),
				resolved.slotStartAt(),
				resolved.slotEndAt(),
				now.plusSeconds(HOLD_MINUTES * 60L),
				resolved.professional().getId()
		);
		var saved = bookings.save(booking);
		var payment = createPaymentIntentInternal(
				saved,
				null,
				command.idempotencyKey() == null ? UUID.randomUUID().toString() : command.idempotencyKey()
		);
		saved.attachPayment(payment.getId());
		return toBookingSummary(bookings.save(saved), payment, zoneId);
	}

	@Transactional(readOnly = true)
	public BookingSummary getBooking(UUID bookingId) {
		var booking = bookings.findById(bookingId).orElseThrow(() -> new IllegalArgumentException("Booking not found"));
		expireBookingIfNeeded(booking);
		var payment = booking.getPaymentId() == null ? null : payments.findById(booking.getPaymentId()).orElse(null);
		var site = requireSite(booking.getSiteId());
		return toBookingSummary(booking, payment, ZoneId.of(site.getTimezone()));
	}

	@Transactional(readOnly = true)
	public List<NotificationSummary> listBookingNotifications(UUID bookingId) {
		var booking = bookings.findById(bookingId).orElseThrow(() -> new IllegalArgumentException("Booking not found"));
		return notificationLogs.findAllByBookingIdOrderByCreatedAtDesc(booking.getId()).stream()
				.map(this::toNotificationSummary)
				.toList();
	}

	@Transactional
	public PaymentSummary createPaymentIntent(UUID bookingId) {
		return createPaymentIntent(bookingId, null, UUID.randomUUID().toString());
	}

	@Transactional
	public PaymentSummary createPaymentIntent(UUID bookingId, String providerKey, String idempotencyKey) {
		var booking = bookings.findById(bookingId).orElseThrow(() -> new IllegalArgumentException("Booking not found"));
		expireBookingIfNeeded(booking);
		if (booking.getStatus() == PublicBooking.Status.EXPIRED) {
			throw new IllegalArgumentException("Booking has expired");
		}

		var payment = createPaymentIntentInternal(booking, providerKey, idempotencyKey);
		booking.attachPayment(payment.getId());
		bookings.save(booking);
		return toPaymentSummary(payment);
	}

	@Transactional
	public BookingSummary completePayment(UUID bookingId, String providerStatus) {
		var booking = bookings.findById(bookingId).orElseThrow(() -> new IllegalArgumentException("Booking not found"));
		expireBookingIfNeeded(booking);
		if (booking.getStatus() == PublicBooking.Status.EXPIRED) {
			throw new IllegalArgumentException("Booking has expired");
		}

		var payment = payments.findFirstByBookingIdOrderByCreatedAtDesc(bookingId)
				.orElseThrow(() -> new IllegalArgumentException("Payment intent not found"));
		if (booking.getStatus() == PublicBooking.Status.CONFIRMED && payment.getStatus() == PublicPayment.Status.PAID) {
			return getBooking(bookingId);
		}

		payment.markPaid(providerStatus == null || providerStatus.isBlank() ? "PAID" : providerStatus);
		return confirmPaidBooking(booking, payment);
	}

	@Transactional
	public BookingSummary handleWebhook(PaymentWebhookCommand command) {
		var payment = paymentService.resolvePayment(command);
		if (paymentService.isDuplicateWebhook(payment, command)) {
			return getBooking(payment.getBookingId());
		}

		var booking = bookings.findById(payment.getBookingId()).orElseThrow(() -> new IllegalArgumentException("Booking not found"));
		expireBookingIfNeeded(booking);
		if (booking.getStatus() == PublicBooking.Status.EXPIRED) {
			paymentService.expireFromWebhook(payment, command);
			return getBooking(payment.getBookingId());
		}

		if (payment.getStatus() == PublicPayment.Status.PAID || booking.getStatus() == PublicBooking.Status.CONFIRMED) {
			payment.rememberWebhookIdempotencyKey(command.eventId() == null ? command.idempotencyKey() : command.eventId());
			payments.save(payment);
			return getBooking(payment.getBookingId());
		}

		var update = paymentService.applyWebhook(payment, command);
		if (update.shouldConfirmBooking()) {
			return confirmPaidBooking(booking, update.payment());
		}
		return getBooking(payment.getBookingId());
	}

	private PublicPayment createPaymentIntentInternal(PublicBooking booking, String providerKey, String idempotencyKey) {
		return paymentService.createIntent(booking, providerKey, idempotencyKey, confirmationPath(booking.getId()));
	}

	private BookingSummary confirmPaidBooking(PublicBooking booking, PublicPayment payment) {
		if (booking.getStatus() == PublicBooking.Status.CONFIRMED && booking.getAppointmentId() != null) {
			var site = requireSite(booking.getSiteId());
			return toBookingSummary(booking, payment, ZoneId.of(site.getTimezone()));
		}
		var patient = resolvePatient(booking);
		var appointment = createAppointmentForBooking(booking, patient.getId());
		booking.confirm(patient.getId(), appointment.getId());
		payments.save(payment);
		bookings.save(booking);
		var paidAt = payment.getPaidAt() != null ? payment.getPaidAt() : Instant.now();
		eventPublisher.publishEvent(new PublicPaymentPaidEvent(
				booking.getOrganizationId(),
				booking.getSiteId(),
				payment.getId(),
				booking.getId(),
				booking.getProfessionalId(),
				booking.getAppointmentStartAt(),
				booking.getAppointmentEndAt(),
				payment.getAmount(),
				payment.getCurrency(),
				paidAt
		));
		notificationService.dispatchBookingConfirmation(booking, requireSite(booking.getSiteId()));

		var site = requireSite(booking.getSiteId());
		return toBookingSummary(booking, payment, ZoneId.of(site.getTimezone()));
	}

	private String confirmationPath(UUID bookingId) {
		return "/booking/confirmation/" + bookingId;
	}

	private Patient resolvePatient(PublicBooking booking) {
		if (booking.getPatientId() != null) {
			return patients.findByIdAndOrganizationIdAndSiteId(booking.getPatientId(), booking.getOrganizationId(), booking.getSiteId())
					.orElseThrow(() -> new IllegalArgumentException("Patient not found for booking"));
		}

		var existing = findExistingPatient(booking);
		if (existing.isPresent()) {
			return existing.get();
		}

		var patient = Patient.create(
				booking.getOrganizationId(),
				booking.getSiteId(),
				null,
				booking.getPatientName(),
				null,
				booking.getPatientPhone(),
				booking.getPatientEmail()
		);
		var saved = patients.save(patient);
		eventPublisher.publishEvent(new PatientRegisteredEvent(
				saved.getOrganizationId(),
				saved.getSiteId(),
				saved.getId(),
				saved.getCreatedAt()
		));
		return saved;
	}

	private Optional<Patient> findExistingPatient(PublicBooking booking) {
		if (booking.getPatientEmail() != null && !booking.getPatientEmail().isBlank()) {
			var byEmail = patients.findFirstByOrganizationIdAndSiteIdAndEmailIgnoreCase(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getPatientEmail()
			);
			if (byEmail.isPresent()) {
				return byEmail;
			}
		}

		if (booking.getPatientPhone() != null && !booking.getPatientPhone().isBlank()) {
			return patients.findFirstByOrganizationIdAndSiteIdAndPhone(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getPatientPhone()
			);
		}

		return Optional.empty();
	}

	private Appointment createAppointmentForBooking(PublicBooking booking, UUID patientId) {
		boolean overlap = appointments.existsOverlapping(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getProfessionalId(),
				booking.getAppointmentStartAt(),
				booking.getAppointmentEndAt()
		);
		if (overlap) {
			throw new IllegalArgumentException("Selected slot is no longer available");
		}

		var reason = "Reserva publica - " + booking.getServiceName() + (booking.getNotes() == null ? "" : " - " + booking.getNotes());
		UUID serviceOfferingId;
		try {
			serviceOfferingId = UUID.fromString(booking.getServiceId());
		} catch (IllegalArgumentException ex) {
			serviceOfferingId = null;
		}
		return appointments.save(Appointment.request(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getProfessionalId(),
				patientId,
				booking.getAppointmentStartAt(),
				booking.getAppointmentEndAt(),
				reason,
				serviceOfferingId,
				booking.getServiceName(),
				booking.getServiceCategory()
		));
	}

	private Optional<Professional> firstAvailableProfessional(
			Site site,
			List<Professional> candidates,
			Instant slotStart,
			Instant slotEnd,
			Instant now
	) {
		return candidates.stream()
				.filter(professional -> !appointments.existsOverlapping(site.getOrganizationId(), site.getId(), professional.getId(), slotStart, slotEnd))
				.filter(professional -> !bookings.existsActiveOverlap(site.getOrganizationId(), site.getId(), professional.getId(), slotStart, slotEnd, now))
				.findFirst();
	}

	private List<Professional> eligibleProfessionals(Site site, PublishedOfferingView offering) {
		var explicit = publishedCatalog.explicitProfessionalIds(site.getOrganizationId(), site.getId(), offering.offeringId());
		if (!explicit.isEmpty()) {
			var assigned = professionals.findAllByOrganizationIdAndIdIn(site.getOrganizationId(), explicit).stream()
					.filter(professional -> professional.getStatus() == ProfessionalStatus.ACTIVE)
					.toList();
			if (!assigned.isEmpty()) {
				return assigned;
			}
		}

		var primary = professionals.findAllByOrganizationIdAndDefaultSiteIdAndStatus(site.getOrganizationId(), site.getId(), ProfessionalStatus.ACTIVE);
		var source = primary.isEmpty()
				? professionals.findAllByOrganizationIdAndStatus(site.getOrganizationId(), ProfessionalStatus.ACTIVE)
				: primary;

		var filtered = source.stream()
				.filter(professional -> specialtyMatches(professional, offering))
				.toList();
		return filtered.isEmpty() ? source : filtered;
	}

	private boolean specialtyMatches(Professional professional, PublishedOfferingView offering) {
		var specialty = normalize(professional.getSpecialty());
		return offering.specialtyMatchTokens().stream().map(this::normalize).anyMatch(specialty::contains);
	}

	private String normalize(String value) {
		return value == null ? "" : value.toLowerCase(Locale.ROOT);
	}

	private long resolvePrice(PublishedOfferingView definition) {
		return definition.promoPrice() != null ? definition.promoPrice() : definition.basePrice();
	}

	private QuotedSlot resolveQuotedSlot(UUID siteId, String serviceId, Instant slotStartAt, Instant now) {
		var site = requireSite(siteId);
		var definition = requireOffering(site, serviceId);
		if (slotStartAt == null || !slotStartAt.isAfter(now)) {
			throw new IllegalArgumentException("Selected slot must be in the future");
		}

		var slotEndAt = slotStartAt.plusSeconds(definition.durationMinutes() * 60L);
		var professional = firstAvailableProfessional(site, eligibleProfessionals(site, definition), slotStartAt, slotEndAt, now)
				.orElseThrow(() -> new IllegalArgumentException("Selected slot is no longer available"));
		return new QuotedSlot(site, definition, slotStartAt, slotEndAt, professional);
	}

	private QuoteSummary toQuoteSummary(QuotedSlot quotedSlot) {
		return new QuoteSummary(
				quotedSlot.site().getId(),
				quotedSlot.site().getName(),
				quotedSlot.definition().publicId(),
				quotedSlot.definition().title(),
				quotedSlot.definition().categoryDisplayName(),
				quotedSlot.slotStartAt(),
				quotedSlot.slotEndAt(),
				quotedSlot.professional().getId(),
				quotedSlot.professional().getFullName(),
				quotedSlot.definition().basePrice(),
				quotedSlot.definition().promoPrice(),
				resolvePrice(quotedSlot.definition()),
				"COP",
				quotedSlot.site().getTimezone(),
				HOLD_MINUTES,
				PublicBooking.Status.PENDING_PAYMENT.name()
		);
	}

	private PublishedOfferingView requireOffering(Site site, String serviceId) {
		return publishedCatalog.requirePublished(site.getOrganizationId(), site.getId(), serviceId);
	}

	private Site requireSite(UUID siteId) {
		if (siteId == null) {
			throw new IllegalArgumentException("siteId is required");
		}
		var site = sites.findById(siteId).orElseThrow(() -> new IllegalArgumentException("Site not found"));
		if (site.getStatus() != SiteStatus.ACTIVE) {
			throw new IllegalArgumentException("Site is not available for public booking");
		}
		return site;
	}

	private void expireBookingIfNeeded(PublicBooking booking) {
		if (booking.getStatus() == PublicBooking.Status.PENDING_PAYMENT
				&& booking.getExpiresAt() != null
				&& booking.getExpiresAt().isBefore(Instant.now())) {
			booking.expire();
			bookings.save(booking);
			if (booking.getPaymentId() != null) {
				payments.findById(booking.getPaymentId()).ifPresent(payment -> {
					if (payment.getStatus() != PublicPayment.Status.PAID) {
						payment.markExpired();
						payments.save(payment);
					}
				});
			}
		}
	}

	private BookingSummary toBookingSummary(PublicBooking booking, PublicPayment payment, ZoneId zoneId) {
		return new BookingSummary(
				booking.getId(),
				booking.getSiteId(),
				booking.getServiceId(),
				booking.getServiceName(),
				booking.getServiceCategory(),
				booking.getPatientName(),
				booking.getPatientEmail(),
				booking.getPatientPhone(),
				booking.getNotes(),
				booking.getQuotedPrice(),
				booking.getAppointmentStartAt(),
				booking.getAppointmentEndAt(),
				booking.getStatus().name(),
				booking.getExpiresAt(),
				booking.getAppointmentId(),
				booking.getProfessionalId(),
				zoneId.getId(),
				payment == null ? null : toPaymentSummary(payment)
		);
	}

	private PaymentSummary toPaymentSummary(PublicPayment payment) {
		return new PaymentSummary(
				payment.getId(),
				payment.getProviderKey(),
				payment.getProviderReference(),
				payment.getAmount(),
				payment.getCurrency(),
				payment.getStatus().name(),
				payment.getProviderStatus(),
				payment.getCheckoutUrl(),
				payment.getClientSecret(),
				payment.getFailureReason(),
				payment.getExpiresAt(),
				confirmationPath(payment.getBookingId())
		);
	}

	private NotificationSummary toNotificationSummary(PublicNotificationLog log) {
		return new NotificationSummary(
				log.getId(),
				log.getChannel().name(),
				log.getRecipient(),
				log.getTemplateCode(),
				log.getTemplatePayload(),
				log.getStatus().name(),
				log.getAttemptCount(),
				log.getProviderMessageId(),
				log.getErrorMessage(),
				log.getSentAt(),
				log.getCreatedAt()
		);
	}

	public record ServiceSummary(
			String id,
			String category,
			String title,
			String description,
			int durationMinutes,
			long basePrice,
			Long promoPrice,
			String badge,
			List<String> features,
			long priceToPay
	) {}

	public record AvailabilitySummary(UUID siteId, String serviceId, List<AvailabilitySlot> slots) {}

	public record AvailabilitySlot(Instant startAt, Instant endAt, UUID professionalId, String professionalName) {}

	public record QuoteBookingCommand(UUID siteId, String serviceId, Instant slotStartAt) {}

	public record QuoteSummary(
			UUID siteId,
			String siteName,
			String serviceId,
			String serviceName,
			String serviceCategory,
			Instant slotStartAt,
			Instant slotEndAt,
			UUID professionalId,
			String professionalName,
			long basePrice,
			Long promoPrice,
			long quotedPrice,
			String currency,
			String timezone,
			int holdMinutes,
			String nextStatus
	) {}

	public record CreateBookingCommand(
			UUID siteId,
			String serviceId,
			Instant slotStartAt,
			String patientName,
			String email,
			String phone,
			String notes,
			String idempotencyKey
	) {}

	public record PaymentWebhookCommand(
			UUID bookingId,
			String providerKey,
			String providerReference,
			String status,
			String eventId,
			String idempotencyKey
	) {}

	public record BookingSummary(
			UUID id,
			UUID siteId,
			String serviceId,
			String serviceName,
			String serviceCategory,
			String patientName,
			String patientEmail,
			String patientPhone,
			String notes,
			long quotedPrice,
			Instant appointmentStartAt,
			Instant appointmentEndAt,
			String status,
			Instant expiresAt,
			UUID appointmentId,
			UUID professionalId,
			String timezone,
			PaymentSummary payment
	) {}

	public record PaymentSummary(
			UUID id,
			String providerKey,
			String providerReference,
			long amount,
			String currency,
			String status,
			String providerStatus,
			String checkoutUrl,
			String clientSecret,
			String failureReason,
			Instant expiresAt,
			String confirmationPath
	) {}

	public record NotificationSummary(
			UUID id,
			String channel,
			String recipient,
			String templateCode,
			String templatePayload,
			String status,
			int attemptCount,
			String providerMessageId,
			String errorMessage,
			Instant sentAt,
			Instant createdAt
	) {}

	private record QuotedSlot(
			Site site,
			PublishedOfferingView definition,
			Instant slotStartAt,
			Instant slotEndAt,
			Professional professional
	) {}

}
