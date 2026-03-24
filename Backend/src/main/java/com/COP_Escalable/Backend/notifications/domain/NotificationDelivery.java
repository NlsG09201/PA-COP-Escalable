package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
		name = "notification_deliveries",
		uniqueConstraints = {
				@UniqueConstraint(name = "uk_notification_delivery_target", columnNames = {"outbox_message_id", "channel", "audience", "recipient"})
		}
)
public class NotificationDelivery extends TenantScopedEntity {
	@Column(name = "outbox_message_id", nullable = false)
	private UUID outboxMessageId;

	@Column(name = "appointment_id")
	private UUID appointmentId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "event_type", nullable = false)
	private String eventType;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AlertAudience audience;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Channel channel;

	@Column(nullable = false)
	private String recipient;

	@Column(name = "template_code", nullable = false)
	private String templateCode;

	@Column
	private String subject;

	@Column(name = "message_body", nullable = false, columnDefinition = "text")
	private String messageBody;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Column(name = "attempt_count", nullable = false)
	private int attemptCount;

	@Column(name = "provider_message_id")
	private String providerMessageId;

	@Column(name = "error_message")
	private String errorMessage;

	@Column(name = "next_attempt_at")
	private Instant nextAttemptAt;

	@Column(name = "sent_at")
	private Instant sentAt;

	protected NotificationDelivery() {}

	public static NotificationDelivery create(
			NotificationOutboxMessage outboxMessage,
			AlertAudience audience,
			Channel channel,
			String recipient
	) {
		var delivery = new NotificationDelivery();
		delivery.setTenant(outboxMessage.getOrganizationId(), outboxMessage.getSiteId());
		delivery.outboxMessageId = outboxMessage.getId();
		delivery.appointmentId = outboxMessage.getAppointmentId();
		delivery.patientId = outboxMessage.getPatientId();
		delivery.eventType = outboxMessage.getEventType();
		delivery.audience = audience;
		delivery.channel = channel;
		delivery.recipient = recipient == null ? "" : recipient;
		delivery.templateCode = "pending";
		delivery.messageBody = "";
		delivery.status = Status.PENDING;
		delivery.attemptCount = 0;
		return delivery;
	}

	public void refreshDispatchContext(String recipient, String templateCode, String subject, String messageBody) {
		this.recipient = recipient;
		this.templateCode = templateCode;
		this.subject = subject;
		this.messageBody = messageBody;
	}

	public void markSent(String providerMessageId) {
		status = Status.SENT;
		attemptCount = attemptCount + 1;
		this.providerMessageId = providerMessageId;
		errorMessage = null;
		nextAttemptAt = null;
		sentAt = Instant.now();
	}

	public void markSkipped(String errorMessage) {
		status = Status.SKIPPED;
		attemptCount = attemptCount + 1;
		this.errorMessage = errorMessage;
		nextAttemptAt = null;
	}

	public void markFailed(String errorMessage, Instant nextAttemptAt) {
		status = Status.FAILED;
		attemptCount = attemptCount + 1;
		this.errorMessage = errorMessage;
		this.nextAttemptAt = nextAttemptAt;
	}

	public void markDeadLetter(String errorMessage) {
		status = Status.DEAD_LETTER;
		attemptCount = attemptCount + 1;
		this.errorMessage = errorMessage;
		nextAttemptAt = null;
	}

	public boolean isTerminal() {
		return status == Status.SENT || status == Status.SKIPPED || status == Status.DEAD_LETTER;
	}

	public UUID getOutboxMessageId() {
		return outboxMessageId;
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

	public AlertAudience getAudience() {
		return audience;
	}

	public Channel getChannel() {
		return channel;
	}

	public String getRecipient() {
		return recipient;
	}

	public String getTemplateCode() {
		return templateCode;
	}

	public String getSubject() {
		return subject;
	}

	public String getMessageBody() {
		return messageBody;
	}

	public Status getStatus() {
		return status;
	}

	public int getAttemptCount() {
		return attemptCount;
	}

	public String getProviderMessageId() {
		return providerMessageId;
	}

	public String getErrorMessage() {
		return errorMessage;
	}

	public Instant getNextAttemptAt() {
		return nextAttemptAt;
	}

	public Instant getSentAt() {
		return sentAt;
	}

	public enum Channel {
		EMAIL,
		WHATSAPP
	}

	public enum Status {
		PENDING,
		SENT,
		FAILED,
		SKIPPED,
		DEAD_LETTER
	}
}
