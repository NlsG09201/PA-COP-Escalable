package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.clinical.application.MedicalAlertNotificationEvent;
import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "notification_outbox_messages")
public class NotificationOutboxMessage extends TenantScopedEntity {

	@Field("appointment_id")
	private UUID appointmentId;

	@Field("patient_id")
	private UUID patientId;

	@Field("event_type")
	private String eventType;

	private String payload;

	private Status status;

	@Field("relay_attempt_count")
	private int relayAttemptCount;

	@Field("next_relay_attempt_at")
	private Instant nextRelayAttemptAt;

	@Field("last_published_at")
	private Instant lastPublishedAt;

	@Field("relay_error_message")
	private String relayErrorMessage;

	@Field("delivery_retry_at")
	private Instant deliveryRetryAt;

	@Field("delivery_error_message")
	private String deliveryErrorMessage;

	protected NotificationOutboxMessage() {}

	public static NotificationOutboxMessage pending(AppointmentLifecycleEvent event, String payload) {
		var message = new NotificationOutboxMessage();
		message.init(event.organizationId(), event.siteId(), event.appointmentId(), event.patientId(), event.eventType().code(), payload);
		return message;
	}

	public static NotificationOutboxMessage pending(MedicalAlertNotificationEvent event, String payload) {
		var message = new NotificationOutboxMessage();
		message.init(event.organizationId(), event.siteId(), null, event.patientId(), event.eventTypeCode(), payload);
		return message;
	}

	public void markPublished() {
		status = Status.PUBLISHED;
		lastPublishedAt = Instant.now();
		relayErrorMessage = null;
	}

	public void markRelayFailure(String errorMessage, Instant nextAttemptAt) {
		status = Status.FAILED;
		relayAttemptCount = relayAttemptCount + 1;
		nextRelayAttemptAt = nextAttemptAt;
		relayErrorMessage = errorMessage;
	}

	public void scheduleDeliveryRetry(Instant nextAttemptAt, String errorMessage) {
		deliveryRetryAt = nextAttemptAt;
		deliveryErrorMessage = errorMessage;
	}

	public void clearDeliveryRetry() {
		deliveryRetryAt = null;
		deliveryErrorMessage = null;
	}

	public UUID getAppointmentId() {
		return appointmentId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public String getEventType() {
		return eventType;
	}

	public String getPayload() {
		return payload;
	}

	public Status getStatus() {
		return status;
	}

	public int getRelayAttemptCount() {
		return relayAttemptCount;
	}

	public Instant getNextRelayAttemptAt() {
		return nextRelayAttemptAt;
	}

	public Instant getLastPublishedAt() {
		return lastPublishedAt;
	}

	public String getRelayErrorMessage() {
		return relayErrorMessage;
	}

	public Instant getDeliveryRetryAt() {
		return deliveryRetryAt;
	}

	public String getDeliveryErrorMessage() {
		return deliveryErrorMessage;
	}

	public enum Status {
		PENDING,
		PUBLISHED,
		FAILED
	}

	private void init(UUID organizationId, UUID siteId, UUID appointmentId, UUID patientId, String eventType, String payload) {
		setTenant(organizationId, siteId);
		this.appointmentId = appointmentId;
		this.patientId = patientId;
		this.eventType = eventType;
		this.payload = payload;
		this.status = Status.PENDING;
		this.relayAttemptCount = 0;
		this.nextRelayAttemptAt = Instant.now();
	}
}
