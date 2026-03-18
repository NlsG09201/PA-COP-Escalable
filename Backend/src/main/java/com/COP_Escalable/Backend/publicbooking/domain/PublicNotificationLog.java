package com.COP_Escalable.Backend.publicbooking.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "public_notification_logs")
public class PublicNotificationLog extends TenantScopedEntity {
	@Column(nullable = false)
	private UUID bookingId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Channel channel;

	@Column
	private String recipient;

	@Column(nullable = false)
	private String templateCode;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Column(nullable = false)
	private int attemptCount;

	@Column(columnDefinition = "text")
	private String templatePayload;

	@Column
	private String providerMessageId;

	@Column
	private String errorMessage;

	@Column
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
