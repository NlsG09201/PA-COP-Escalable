package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;

import java.time.Instant;
import java.util.UUID;

public interface PublicPaymentProvider {
	String key();

	PaymentIntent createIntent(CreatePaymentIntentCommand command);

	WebhookResolution resolveWebhook(WebhookPayload payload);

	record CreatePaymentIntentCommand(
			UUID organizationId,
			UUID siteId,
			UUID bookingId,
			String serviceName,
			String patientName,
			String patientEmail,
			String patientPhone,
			long amount,
			String currency,
			Instant expiresAt,
			String idempotencyKey,
			String confirmationPath
	) {}

	record PaymentIntent(
			String providerReference,
			String providerStatus,
			PublicPayment.Status paymentStatus,
			String checkoutUrl,
			String clientSecret,
			Instant expiresAt
	) {}

	record WebhookPayload(
			UUID bookingId,
			String providerReference,
			String rawStatus,
			String eventId,
			String idempotencyKey
	) {}

	record WebhookResolution(
			String providerReference,
			String providerStatus,
			PublicPayment.Status paymentStatus,
			String failureReason
	) {}
}
