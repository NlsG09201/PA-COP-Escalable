package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_outbox_messages")
public class NotificationOutboxMessage extends TenantScopedEntity {
	@Column(name = "appointment_id", nullable = false)
	private UUID appointmentId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "event_type", nullable = false)
	private String eventType;

	@Column(nullable = false, columnDefinition = "text")
	private String payload;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Column(name = "relay_attempt_count", nullable = false)
	private int relayAttemptCount;

	@Column(name = "next_relay_attempt_at", nullable = false)
	private Instant nextRelayAttemptAt;

	@Column(name = "last_published_at")
	private Instant lastPublishedAt;

	@Column(name = "relay_error_message")
	private String relayErrorMessage;

	@Column(name = "delivery_retry_at")
	private Instant deliveryRetryAt;

	@Column(name = "delivery_error_message")
	private String deliveryErrorMessage;

	protected NotificationOutboxMessage() {}

	public static NotificationOutboxMessage pending(AppointmentLifecycleEvent event, String payload) {
		var message = new NotificationOutboxMessage();
		message.setTenant(event.organizationId(), event.siteId());
		message.appointmentId = event.appointmentId();
		message.patientId = event.patientId();
		message.eventType = event.eventType().code();
		message.payload = payload;
		message.status = Status.PENDING;
		message.relayAttemptCount = 0;
		message.nextRelayAttemptAt = Instant.now();
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
}
