package com.COP_Escalable.Backend.publicbooking.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "public_notification_logs")
public class PublicNotificationLog extends TenantScopedEntity {

	@Field("booking_id")
	private UUID bookingId;

	private Channel channel;

	private String recipient;

	@Field("template_code")
	private String templateCode;

	private Status status;

	@Field("attempt_count")
	private int attemptCount;

	@Field("template_payload")
	private String templatePayload;

	@Field("provider_message_id")
	private String providerMessageId;

	@Field("error_message")
	private String errorMessage;

	@Field("sent_at")
	private Instant sentAt;

	protected PublicNotificationLog() {}

	public static PublicNotificationLog sent(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			Channel channel,
			String recipient,
			String templateCode,
			String templatePayload,
			String providerMessageId,
			int attemptCount
	) {
		var log = new PublicNotificationLog();
		log.setTenant(organizationId, siteId);
		log.bookingId = bookingId;
		log.channel = channel;
		log.recipient = recipient;
		log.templateCode = templateCode;
		log.status = Status.SENT;
		log.attemptCount = attemptCount;
		log.templatePayload = templatePayload;
		log.providerMessageId = providerMessageId;
		log.sentAt = Instant.now();
		return log;
	}

	public static PublicNotificationLog skipped(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			Channel channel,
			String recipient,
			String templateCode,
			String templatePayload,
			String errorMessage,
			int attemptCount
	) {
		var log = new PublicNotificationLog();
		log.setTenant(organizationId, siteId);
		log.bookingId = bookingId;
		log.channel = channel;
		log.recipient = recipient;
		log.templateCode = templateCode;
		log.status = Status.SKIPPED;
		log.attemptCount = attemptCount;
		log.templatePayload = templatePayload;
		log.errorMessage = errorMessage;
		return log;
	}

	public static PublicNotificationLog failed(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			Channel channel,
			String recipient,
			String templateCode,
			String templatePayload,
			String errorMessage,
			int attemptCount
	) {
		var log = new PublicNotificationLog();
		log.setTenant(organizationId, siteId);
		log.bookingId = bookingId;
		log.channel = channel;
		log.recipient = recipient;
		log.templateCode = templateCode;
		log.status = Status.FAILED;
		log.attemptCount = attemptCount;
		log.templatePayload = templatePayload;
		log.errorMessage = errorMessage;
		return log;
	}

	public UUID getBookingId() {
		return bookingId;
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

	public Status getStatus() {
		return status;
	}

	public int getAttemptCount() {
		return attemptCount;
	}

	public String getTemplatePayload() {
		return templatePayload;
	}

	public String getProviderMessageId() {
		return providerMessageId;
	}

	public String getErrorMessage() {
		return errorMessage;
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
		SKIPPED
	}
}
