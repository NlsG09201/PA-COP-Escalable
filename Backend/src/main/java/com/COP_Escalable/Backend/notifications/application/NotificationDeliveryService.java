package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentEventType;
import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
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

	private final NotificationOutboxRepository outboxRepository;
	private final NotificationDeliveryRepository deliveryRepository;
	private final PatientRepository patientRepository;
	private final SiteRepository siteRepository;
	private final ProfessionalRepository professionalRepository;
	private final EmailNotificationGateway emailGateway;
	private final WhatsappNotificationGateway whatsappGateway;
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

		var event = deserialize(outboxMessage.getPayload());
		var patient = patientRepository.findByIdAndOrganizationIdAndSiteId(event.patientId(), event.organizationId(), event.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found for event " + outboxMessageId));
		var site = siteRepository.findByIdAndOrganizationId(event.siteId(), event.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Site not found for event " + outboxMessageId));
		var professional = professionalRepository.findByIdAndOrganizationId(event.professionalId(), event.organizationId())
				.orElse(null);

		Instant nextRetryAt = null;
		String retryError = null;

		for (var channel : List.of(NotificationDelivery.Channel.EMAIL, NotificationDelivery.Channel.WHATSAPP)) {
			var delivery = deliveryRepository.findByOutboxMessageIdAndChannel(outboxMessageId, channel)
					.orElseGet(() -> NotificationDelivery.create(outboxMessage, channel));

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

			var rendered = renderNotification(event, outboxMessage.getId(), patient, site, professional, channel);
			delivery.refreshDispatchContext(
					rendered.recipient(),
					rendered.templateCode(),
					rendered.subject(),
					rendered.messageBody()
			);

			var result = dispatch(rendered);
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

	private AppointmentLifecycleEvent deserialize(String payload) {
		try {
			return objectMapper.readValue(payload, AppointmentLifecycleEvent.class);
		} catch (JsonProcessingException ex) {
			throw new IllegalArgumentException("Unable to deserialize appointment notification payload", ex);
		}
	}

	private RenderedNotification renderNotification(
			AppointmentLifecycleEvent event,
			UUID outboxMessageId,
			Patient patient,
			Site site,
			Professional professional,
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
		var templateCode = "appointment-" + event.eventType().code().replace('_', '-') + "-" + channel.name().toLowerCase(Locale.ROOT);
		var recipient = channel == NotificationDelivery.Channel.EMAIL ? patient.getEmail() : patient.getPhone();

		return new RenderedNotification(
				outboxMessageId,
				channel,
				recipient,
				templateCode,
				subject,
				body
		);
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
		};
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
}

record RenderedNotification(
		UUID outboxMessageId,
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
