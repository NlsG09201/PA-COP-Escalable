package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "notification_deliveries")
public class NotificationDelivery extends TenantScopedEntity {

	@Field("outbox_message_id")
	private UUID outboxMessageId;

	@Field("appointment_id")
	private UUID appointmentId;

	@Field("patient_id")
	private UUID patientId;

	@Field("event_type")
	private String eventType;

	private AlertAudience audience;

	private Channel channel;

	private String recipient;

	@Field("template_code")
	private String templateCode;

	private String subject;

	@Field("message_body")
	private String messageBody;

	private Status status;

	@Field("attempt_count")
	private int attemptCount;

	@Field("provider_message_id")
	private String providerMessageId;

	@Field("error_message")
	private String errorMessage;

	@Field("next_attempt_at")
	private Instant nextAttemptAt;

	@Field("sent_at")
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
