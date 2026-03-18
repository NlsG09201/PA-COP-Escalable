package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicNotificationLogRepository;
import com.COP_Escalable.Backend.tenancy.domain.Site;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class PublicBookingNotificationService {
	private static final DateTimeFormatter NOTIFICATION_DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
	private static final DateTimeFormatter NOTIFICATION_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

	private final PublicNotificationLogRepository notificationLogs;
	private final PublicNotificationAdapter notificationAdapter;
	private final PublicNotificationProperties notificationProperties;
	private final ObjectMapper objectMapper;

	public PublicBookingNotificationService(
			PublicNotificationLogRepository notificationLogs,
			PublicNotificationAdapter notificationAdapter,
			PublicNotificationProperties notificationProperties,
			ObjectMapper objectMapper
	) {
		this.notificationLogs = notificationLogs;
		this.notificationAdapter = notificationAdapter;
		this.notificationProperties = notificationProperties;
		this.objectMapper = objectMapper;
	}

	public void dispatchBookingConfirmation(PublicBooking booking, Site site) {
		dispatchToChannel(booking, site, PublicNotificationLog.Channel.EMAIL);
		dispatchToChannel(booking, site, PublicNotificationLog.Channel.WHATSAPP);
	}

	private void dispatchToChannel(PublicBooking booking, Site site, PublicNotificationLog.Channel channel) {
		String recipient = channel == PublicNotificationLog.Channel.EMAIL ? booking.getPatientEmail() : booking.getPatientPhone();
		int attemptCount = Math.toIntExact(notificationLogs.countByBookingIdAndChannel(booking.getId(), channel) + 1);
		String templateCode = notificationProperties.templateCodeFor(channel);
		String templatePayload = toNotificationPayloadJson(buildNotificationPayload(booking, site, channel));
		try {
			var result = notificationAdapter.sendBookingConfirmation(new PublicNotificationAdapter.BookingConfirmationNotification(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getId(),
					channel,
					recipient,
					templateCode,
					templatePayload,
					attemptCount
			));
			notificationLogs.save(toNotificationLog(booking, channel, recipient, templateCode, templatePayload, attemptCount, result));
		} catch (RuntimeException ex) {
			notificationLogs.save(PublicNotificationLog.failed(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getId(),
					channel,
					recipient,
					templateCode,
					templatePayload,
					ex.getMessage(),
					attemptCount
			));
		}
	}

	private PublicNotificationLog toNotificationLog(
			PublicBooking booking,
			PublicNotificationLog.Channel channel,
			String recipient,
			String templateCode,
			String templatePayload,
			int attemptCount,
			PublicNotificationAdapter.DispatchResult result
	) {
		return switch (result.status()) {
			case SENT -> PublicNotificationLog.sent(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getId(),
					channel,
					recipient,
					templateCode,
					templatePayload,
					result.providerMessageId(),
					attemptCount
			);
			case SKIPPED -> PublicNotificationLog.skipped(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getId(),
					channel,
					recipient,
					templateCode,
					templatePayload,
					result.errorMessage(),
					attemptCount
			);
			case FAILED, PENDING -> PublicNotificationLog.failed(
					booking.getOrganizationId(),
					booking.getSiteId(),
					booking.getId(),
					channel,
					recipient,
					templateCode,
					templatePayload,
					result.errorMessage() == null ? "Notification delivery failed" : result.errorMessage(),
					attemptCount
			);
		};
	}

	private BookingConfirmationTemplatePayload buildNotificationPayload(
			PublicBooking booking,
			Site site,
			PublicNotificationLog.Channel channel
	) {
		var zoneId = ZoneId.of(site.getTimezone());
		var appointmentStart = booking.getAppointmentStartAt().atZone(zoneId);
		return new BookingConfirmationTemplatePayload(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getId(),
				channel.name(),
				booking.getPatientName(),
				booking.getPatientEmail(),
				booking.getPatientPhone(),
				booking.getServiceName(),
				booking.getServiceCategory(),
				site.getName(),
				booking.getAppointmentStartAt(),
				booking.getAppointmentEndAt(),
				NOTIFICATION_DATE_FORMATTER.format(appointmentStart.toLocalDate()),
				NOTIFICATION_TIME_FORMATTER.format(appointmentStart.toLocalTime()),
				site.getTimezone(),
				"/booking/confirmation/" + booking.getId()
		);
	}

	private String toNotificationPayloadJson(BookingConfirmationTemplatePayload payload) {
		try {
			return objectMapper.writeValueAsString(payload);
		} catch (JsonProcessingException ex) {
			throw new IllegalStateException("Unable to serialize notification payload", ex);
		}
	}

	private record BookingConfirmationTemplatePayload(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			String channel,
			String patientName,
			String patientEmail,
			String patientPhone,
			String serviceName,
			String serviceCategory,
			String siteName,
			java.time.Instant appointmentStartAt,
			java.time.Instant appointmentEndAt,
			String appointmentDate,
			String appointmentTime,
			String timezone,
			String confirmationPath
	) {}
}
