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
@Table(name = "public_payments")
public class PublicPayment extends TenantScopedEntity {
	@Column(nullable = false)
	private UUID bookingId;

	@Column(nullable = false)
	private String providerKey;

	@Column(nullable = false)
	private String providerReference;

	@Column
	private String providerStatus;

	@Column
	private String checkoutUrl;

	@Column
	private String clientSecret;

	@Column
	private String failureReason;

	@Column(nullable = false)
	private long amount;

	@Column(nullable = false)
	private String currency;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Column
	private String idempotencyKey;

	@Column
	private String lastWebhookIdempotencyKey;

	@Column
	private Instant expiresAt;

	@Column
	private Instant paidAt;

	protected PublicPayment() {}

	public static PublicPayment create(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			String providerKey,
			String providerReference,
			String providerStatus,
			Status status,
			long amount,
			String currency,
			String idempotencyKey,
			Instant expiresAt,
			String checkoutUrl,
			String clientSecret
	) {
		var payment = new PublicPayment();
		payment.setTenant(organizationId, siteId);
		payment.bookingId = bookingId;
		payment.providerKey = providerKey;
		payment.providerReference = providerReference;
		payment.providerStatus = providerStatus;
		payment.amount = amount;
		payment.currency = currency == null || currency.isBlank() ? "COP" : currency.trim().toUpperCase();
		payment.status = status == null ? Status.REQUIRES_ACTION : status;
		payment.idempotencyKey = idempotencyKey;
		payment.expiresAt = expiresAt;
		payment.checkoutUrl = checkoutUrl;
		payment.clientSecret = clientSecret;
		return payment;
	}

	public void markPaid(String providerStatus) {
		this.providerStatus = providerStatus;
		this.status = Status.PAID;
		this.failureReason = null;
		this.lastWebhookIdempotencyKey = null;
		this.expiresAt = null;
		this.paidAt = Instant.now();
	}

	public void markFailed(String providerStatus, String failureReason) {
		this.providerStatus = providerStatus;
		this.status = Status.FAILED;
		this.failureReason = failureReason;
	}

	public void markProcessing(String providerStatus) {
		this.providerStatus = providerStatus;
		this.status = Status.PROCESSING;
		this.failureReason = null;
	}

	public void markRequiresAction(String providerStatus, Instant expiresAt) {
		this.providerStatus = providerStatus;
		this.status = Status.REQUIRES_ACTION;
		this.expiresAt = expiresAt;
		this.failureReason = null;
	}

	public void markCancelled(String providerStatus, String failureReason) {
		this.providerStatus = providerStatus;
		this.status = Status.CANCELLED;
		this.failureReason = failureReason;
	}

	public void markExpired() {
		if (this.status == Status.PAID) {
			return;
		}
		this.providerStatus = "EXPIRED";
		this.status = Status.EXPIRED;
		this.failureReason = null;
	}

	public boolean isReusable() {
		return this.status == Status.REQUIRES_ACTION
				|| this.status == Status.PENDING
				|| this.status == Status.PROCESSING;
	}

	public void rememberWebhookIdempotencyKey(String idempotencyKey) {
		if (idempotencyKey != null && !idempotencyKey.isBlank()) {
			this.lastWebhookIdempotencyKey = idempotencyKey;
		}
	}

	public boolean hasWebhookIdempotencyKey(String idempotencyKey) {
		return idempotencyKey != null
				&& !idempotencyKey.isBlank()
				&& idempotencyKey.equals(this.lastWebhookIdempotencyKey);
	}

	public void applyProviderUpdate(String providerStatus, Status nextStatus, String failureReason) {
		switch (nextStatus == null ? Status.FAILED : nextStatus) {
			case PAID -> markPaid(providerStatus);
			case PROCESSING, PENDING -> markProcessing(providerStatus);
			case REQUIRES_ACTION -> markRequiresAction(providerStatus, this.expiresAt);
			case CANCELLED -> markCancelled(providerStatus, failureReason);
			case EXPIRED -> markExpired();
			case FAILED -> markFailed(providerStatus, failureReason);
		}
	}

	public UUID getBookingId() {
		return bookingId;
	}

	public String getProviderKey() {
		return providerKey;
	}

	public String getProviderReference() {
		return providerReference;
	}

	public String getProviderStatus() {
		return providerStatus;
	}

	public String getCheckoutUrl() {
		return checkoutUrl;
	}

	public String getClientSecret() {
		return clientSecret;
	}

	public String getFailureReason() {
		return failureReason;
	}

	public long getAmount() {
		return amount;
	}

	public String getCurrency() {
		return currency;
	}

	public Status getStatus() {
		return status;
	}

	public String getIdempotencyKey() {
		return idempotencyKey;
	}

	public String getLastWebhookIdempotencyKey() {
		return lastWebhookIdempotencyKey;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public enum Status {
		PENDING,
		REQUIRES_ACTION,
		PROCESSING,
		PAID,
		FAILED,
		CANCELLED,
		EXPIRED
	}
}
