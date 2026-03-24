package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentEventType;
import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.clinical.application.MedicalAlertNotificationEvent;
import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationDeliveryRepository;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import com.COP_Escalable.Backend.patients.domain.Patient;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.Site;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class NotificationDeliveryService {
	private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
	private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
	private static final String MEDICAL_ALERT_EVENT_TYPE = MedicalAlertNotificationEvent.EVENT_TYPE;

	private final NotificationOutboxRepository outboxRepository;
	private final NotificationDeliveryRepository deliveryRepository;
	private final PatientRepository patientRepository;
	private final SiteRepository siteRepository;
	private final ProfessionalRepository professionalRepository;
	private final EmailNotificationGateway emailGateway;
	private final WhatsappNotificationGateway whatsappGateway;
	private final MedicalAlertRoutingService medicalAlertRoutingService;
	private final NotificationProperties properties;
	private final ObjectMapper objectMapper;

	public NotificationDeliveryService(
			NotificationOutboxRepository outboxRepository,
			NotificationDeliveryRepository deliveryRepository,
			PatientRepository patientRepository,
			SiteRepository siteRepository,
			ProfessionalRepository professionalRepository,
			EmailNotificationGateway emailGateway,
			WhatsappNotificationGateway whatsappGateway,
			MedicalAlertRoutingService medicalAlertRoutingService,
			NotificationProperties properties,
			ObjectMapper objectMapper
	) {
		this.outboxRepository = outboxRepository;
		this.deliveryRepository = deliveryRepository;
		this.patientRepository = patientRepository;
		this.siteRepository = siteRepository;
		this.professionalRepository = professionalRepository;
		this.emailGateway = emailGateway;
		this.whatsappGateway = whatsappGateway;
		this.medicalAlertRoutingService = medicalAlertRoutingService;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public void processOutboxMessage(UUID outboxMessageId) {
		var outboxMessage = outboxRepository.findById(outboxMessageId)
				.orElse(null);
		if (outboxMessage == null) {
			return;
		}

		var preparedNotification = prepareNotification(outboxMessage);
		var targets = preparedNotification.targets(outboxMessage.getId());

		Instant nextRetryAt = null;
		String retryError = null;

		for (var target : targets) {
			var delivery = deliveryRepository.findByOutboxMessageIdAndChannelAndAudienceAndRecipient(
							outboxMessageId,
							target.channel(),
							target.audience(),
							target.recipient()
					)
					.orElseGet(() -> NotificationDelivery.create(outboxMessage, target.audience(), target.channel(), target.recipient()));

			if (delivery.isTerminal()) {
				continue;
			}

			if (delivery.getStatus() == NotificationDelivery.Status.FAILED
					&& delivery.getNextAttemptAt() != null
					&& delivery.getNextAttemptAt().isAfter(Instant.now())) {
				nextRetryAt = earliest(nextRetryAt, delivery.getNextAttemptAt());
				retryError = delivery.getErrorMessage();
				continue;
			}

			delivery.refreshDispatchContext(
					target.recipient(),
					target.templateCode(),
					target.subject(),
					target.messageBody()
			);

			var result = dispatch(new RenderedNotification(
					outboxMessage.getId(),
					target.audience(),
					target.channel(),
					target.recipient(),
					target.templateCode(),
					target.subject(),
					target.messageBody()
			));
			switch (result.status()) {
				case SENT -> delivery.markSent(result.providerMessageId());
				case SKIPPED -> delivery.markSkipped(defaultMessage(result.errorMessage(), "Notification skipped"));
				case FAILED -> {
					int nextAttemptNumber = delivery.getAttemptCount() + 1;
					if (nextAttemptNumber >= properties.retry().maxAttempts()) {
						delivery.markDeadLetter(defaultMessage(result.errorMessage(), "Max delivery attempts reached"));
					} else {
						Instant retryAt = Instant.now().plusMillis(computeBackoffMs(nextAttemptNumber));
						delivery.markFailed(defaultMessage(result.errorMessage(), "Notification delivery failed"), retryAt);
						nextRetryAt = earliest(nextRetryAt, retryAt);
						retryError = delivery.getErrorMessage();
					}
				}
				default -> throw new IllegalStateException("Unsupported dispatch result status " + result.status());
			}

			deliveryRepository.save(delivery);
		}

		if (nextRetryAt != null) {
			outboxMessage.scheduleDeliveryRetry(nextRetryAt, defaultMessage(retryError, "Delivery retry scheduled"));
		} else {
			outboxMessage.clearDeliveryRetry();
		}
		outboxRepository.save(outboxMessage);
	}

	private PreparedNotification prepareNotification(NotificationOutboxMessage outboxMessage) {
		if (isAppointmentEvent(outboxMessage.getEventType())) {
			var event = deserializeAppointmentEvent(outboxMessage.getPayload());
			var patient = patientRepository.findByIdAndOrganizationIdAndSiteId(event.patientId(), event.organizationId(), event.siteId())
					.orElseThrow(() -> new IllegalArgumentException("Patient not found for event " + outboxMessage.getId()));
			var site = siteRepository.findByIdAndOrganizationId(event.siteId(), event.organizationId())
					.orElseThrow(() -> new IllegalArgumentException("Site not found for event " + outboxMessage.getId()));
			var professional = professionalRepository.findByIdAndOrganizationId(event.professionalId(), event.organizationId())
					.orElse(null);

			return outboxMessageId -> List.of(
					renderAppointmentNotification(
							event,
							patient,
							site,
							professional,
							AlertAudience.PATIENT,
							NotificationDelivery.Channel.EMAIL
					),
					renderAppointmentNotification(
							event,
							patient,
							site,
							professional,
							AlertAudience.PATIENT,
							NotificationDelivery.Channel.WHATSAPP
					)
			);
		}

		if (MEDICAL_ALERT_EVENT_TYPE.equals(outboxMessage.getEventType())) {
			var event = deserializeMedicalAlertEvent(outboxMessage.getPayload());
			var patient = patientRepository.findByIdAndOrganizationIdAndSiteId(event.patientId(), event.organizationId(), event.siteId())
					.orElseThrow(() -> new IllegalArgumentException("Patient not found for event " + outboxMessage.getId()));
			var site = siteRepository.findByIdAndOrganizationId(event.siteId(), event.organizationId())
					.orElseThrow(() -> new IllegalArgumentException("Site not found for event " + outboxMessage.getId()));

			return outboxMessageId -> renderMedicalAlertNotifications(event, patient, site);
		}

		throw new IllegalArgumentException("Unsupported notification event type " + outboxMessage.getEventType());
	}

	private AppointmentLifecycleEvent deserializeAppointmentEvent(String payload) {
		try {
			return objectMapper.readValue(payload, AppointmentLifecycleEvent.class);
		} catch (JsonProcessingException ex) {
			throw new IllegalArgumentException("Unable to deserialize appointment notification payload", ex);
		}
	}

	private MedicalAlertNotificationEvent deserializeMedicalAlertEvent(String payload) {
		try {
			return objectMapper.readValue(payload, MedicalAlertNotificationEvent.class);
		} catch (JsonProcessingException ex) {
			throw new IllegalArgumentException("Unable to deserialize medical alert payload", ex);
		}
	}

	private DeliveryTarget renderAppointmentNotification(
			AppointmentLifecycleEvent event,
			Patient patient,
			Site site,
			Professional professional,
			AlertAudience audience,
			NotificationDelivery.Channel channel
	) {
		var zoneId = ZoneId.of(site.getTimezone());
		var appointmentStart = event.startAt().atZone(zoneId);
		var professionalName = professional == null ? "tu profesional de salud" : professional.getFullName();
		var appointmentDate = DATE_FORMATTER.format(appointmentStart);
		var appointmentTime = TIME_FORMATTER.format(appointmentStart);
		var siteName = site.getName();
		var greetingName = patient.getFullName();
		var subject = properties.email().subjectPrefix() + " " + subjectFor(event.eventType());
		var body = bodyFor(event.eventType(), greetingName, appointmentDate, appointmentTime, siteName, professionalName);
		var templateCode = "appointment-" + event.eventType().code().replace('_', '-') + "-" + audience.name().toLowerCase(Locale.ROOT) + "-" + channel.name().toLowerCase(Locale.ROOT);
		var recipient = channel == NotificationDelivery.Channel.EMAIL ? patient.getEmail() : patient.getPhone();

		return new DeliveryTarget(
				audience,
				channel,
				recipient == null ? "" : recipient,
				templateCode,
				subject,
				body
		);
	}

	private List<DeliveryTarget> renderMedicalAlertNotifications(
			MedicalAlertNotificationEvent event,
			Patient patient,
			Site site
	) {
		var subject = properties.email().subjectPrefix() + " Alerta medica " + event.severity() + ": " + event.title();
		var body = """
				Hola %s,

				Se genero una alerta medica de severidad %s en %s.
				Asunto: %s
				Detalle: %s
				Generada por: %s
				"""
				.formatted(
						patient.getFullName(),
						event.severity(),
						site.getName(),
						event.title(),
						event.message(),
						event.authorUsername()
				)
				.trim();
		return medicalAlertRoutingService.resolveTargets(event, patient, subject, body);
	}

	private ChannelDispatchResult dispatch(RenderedNotification renderedNotification) {
		return switch (renderedNotification.channel()) {
			case EMAIL -> emailGateway.send(renderedNotification);
			case WHATSAPP -> whatsappGateway.send(renderedNotification);
		};
	}

	private String subjectFor(AppointmentEventType eventType) {
		return switch (eventType) {
			case CITA_CREADA -> "Solicitud de cita registrada";
			case CITA_CONFIRMADA -> "Cita confirmada";
			case CITA_CANCELADA -> "Cita cancelada";
			case RECORDATORIO_CITA -> "Recordatorio de cita";
		};
	}

	private String bodyFor(
			AppointmentEventType eventType,
			String patientName,
			String appointmentDate,
			String appointmentTime,
			String siteName,
			String professionalName
	) {
		return switch (eventType) {
			case CITA_CREADA -> """
					Hola %s,

					Recibimos tu solicitud de cita para el %s a las %s en %s con %s.
					Te enviaremos una nueva notificacion cuando la cita quede confirmada.
					"""
					.formatted(patientName, appointmentDate, appointmentTime, siteName, professionalName).trim();
			case CITA_CONFIRMADA -> """
					Hola %s,

					Tu cita fue confirmada para el %s a las %s en %s con %s.
					Si necesitas cambios, por favor contacta a la clinica.
					"""
					.formatted(patientName, appointmentDate, appointmentTime, siteName, professionalName).trim();
			case CITA_CANCELADA -> """
					Hola %s,

					Tu cita del %s a las %s en %s con %s fue cancelada.
					Si deseas reprogramarla, responde por este mismo canal.
					"""
					.formatted(patientName, appointmentDate, appointmentTime, siteName, professionalName).trim();
			case RECORDATORIO_CITA -> """
					Hola %s,

					Este es un recordatorio de tu cita programada para el %s a las %s en %s con %s.
					Si no podras asistir, avisanos con anticipacion.
					"""
					.formatted(patientName, appointmentDate, appointmentTime, siteName, professionalName).trim();
		};
	}

	private boolean isAppointmentEvent(String eventType) {
		for (var value : AppointmentEventType.values()) {
			if (value.code().equals(eventType)) {
				return true;
			}
		}
		return false;
	}

	private Instant earliest(Instant left, Instant right) {
		if (left == null) {
			return right;
		}
		if (right == null) {
			return left;
		}
		return left.isBefore(right) ? left : right;
	}

	private long computeBackoffMs(int attemptNumber) {
		double candidate = properties.retry().initialBackoffMs() * Math.pow(properties.retry().multiplier(), Math.max(0, attemptNumber - 1));
		return Math.min((long) candidate, properties.retry().maxBackoffMs());
	}

	private String defaultMessage(String value, String fallback) {
		return value == null || value.isBlank() ? fallback : value;
	}

	private interface PreparedNotification {
		List<DeliveryTarget> targets(UUID outboxMessageId);
	}
}

record RenderedNotification(
		UUID outboxMessageId,
		AlertAudience audience,
		NotificationDelivery.Channel channel,
		String recipient,
		String templateCode,
		String subject,
		String messageBody
) {}

record DeliveryTarget(
		AlertAudience audience,
		NotificationDelivery.Channel channel,
		String recipient,
		String templateCode,
		String subject,
		String messageBody
) {}

record ChannelDispatchResult(
		NotificationDelivery.Status status,
		String providerMessageId,
		String errorMessage
) {
	static ChannelDispatchResult sent(String providerMessageId) {
		return new ChannelDispatchResult(NotificationDelivery.Status.SENT, providerMessageId, null);
	}

	static ChannelDispatchResult failed(String errorMessage) {
		return new ChannelDispatchResult(NotificationDelivery.Status.FAILED, null, errorMessage);
	}

	static ChannelDispatchResult skipped(String errorMessage) {
		return new ChannelDispatchResult(NotificationDelivery.Status.SKIPPED, null, errorMessage);
	}
}
