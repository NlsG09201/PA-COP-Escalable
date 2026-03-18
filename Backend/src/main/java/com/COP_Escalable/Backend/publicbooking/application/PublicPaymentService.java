package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicPaymentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PublicPaymentService {
	private final PublicPaymentRepository payments;
	private final Map<String, PublicPaymentProvider> providers;
	private final PublicPaymentProperties properties;

	public PublicPaymentService(
			PublicPaymentRepository payments,
			List<PublicPaymentProvider> providers,
			PublicPaymentProperties properties
	) {
		this.payments = payments;
		this.providers = providers.stream()
				.collect(Collectors.toUnmodifiableMap(provider -> normalize(provider.key()), Function.identity()));
		this.properties = properties;
	}

	public PublicPayment createIntent(PublicBooking booking, String requestedProviderKey, String idempotencyKey, String confirmationPath) {
		var providerKey = properties.resolveProvider(requestedProviderKey);
		if (hasText(idempotencyKey)) {
			var existing = payments.findFirstByBookingIdAndProviderKeyAndIdempotencyKeyOrderByCreatedAtDesc(
					booking.getId(),
					providerKey,
					idempotencyKey
			).orElse(null);
			if (existing != null) {
				return existing;
			}
		}

		var reusable = payments.findFirstByBookingIdAndProviderKeyOrderByCreatedAtDesc(booking.getId(), providerKey).orElse(null);
		if (reusable != null && reusable.isReusable()) {
			return reusable;
		}

		var provider = requireProvider(providerKey);
		var intent = provider.createIntent(new PublicPaymentProvider.CreatePaymentIntentCommand(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getId(),
				booking.getServiceName(),
				booking.getPatientName(),
				booking.getPatientEmail(),
				booking.getPatientPhone(),
				booking.getQuotedPrice(),
				"COP",
				booking.getExpiresAt(),
				idempotencyKey,
				confirmationPath
		));
		return payments.save(PublicPayment.create(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getId(),
				providerKey,
				intent.providerReference(),
				intent.providerStatus(),
				intent.paymentStatus(),
				booking.getQuotedPrice(),
				"COP",
				idempotencyKey,
				intent.expiresAt(),
				intent.checkoutUrl(),
				intent.clientSecret()
		));
	}

	public PublicPayment resolvePayment(PublicBookingService.PaymentWebhookCommand command) {
		if (hasText(command.providerReference())) {
			return payments.findByProviderReference(command.providerReference())
					.orElseThrow(() -> new IllegalArgumentException("Payment not found for webhook"));
		}
		if (command.bookingId() == null) {
			throw new IllegalArgumentException("bookingId or providerReference is required");
		}
		var providerKey = properties.resolveProvider(command.providerKey());
		return payments.findFirstByBookingIdAndProviderKeyOrderByCreatedAtDesc(command.bookingId(), providerKey)
				.or(() -> payments.findFirstByBookingIdOrderByCreatedAtDesc(command.bookingId()))
				.orElseThrow(() -> new IllegalArgumentException("Payment not found for webhook"));
	}

	public boolean isDuplicateWebhook(PublicPayment payment, PublicBookingService.PaymentWebhookCommand command) {
		var deduplicationKey = deduplicationKey(command);
		return payment.hasWebhookIdempotencyKey(deduplicationKey);
	}

	public PublicPayment expireFromWebhook(PublicPayment payment, PublicBookingService.PaymentWebhookCommand command) {
		payment.markExpired();
		payment.rememberWebhookIdempotencyKey(deduplicationKey(command));
		return payments.save(payment);
	}

	public PaymentUpdateResult applyWebhook(PublicPayment payment, PublicBookingService.PaymentWebhookCommand command) {
		var provider = requireProvider(payment.getProviderKey());
		var resolution = provider.resolveWebhook(new PublicPaymentProvider.WebhookPayload(
				command.bookingId(),
				command.providerReference() == null ? payment.getProviderReference() : command.providerReference(),
				command.status(),
				command.eventId(),
				command.idempotencyKey()
		));
		payment.applyProviderUpdate(resolution.providerStatus(), resolution.paymentStatus(), resolution.failureReason());
		payment.rememberWebhookIdempotencyKey(deduplicationKey(command));
		return new PaymentUpdateResult(payments.save(payment), resolution.paymentStatus() == PublicPayment.Status.PAID);
	}

	private PublicPaymentProvider requireProvider(String providerKey) {
		var provider = providers.get(normalize(providerKey));
		if (provider == null) {
			throw new IllegalArgumentException("Unsupported payment provider: " + providerKey);
		}
		return provider;
	}

	private String deduplicationKey(PublicBookingService.PaymentWebhookCommand command) {
		if (hasText(command.eventId())) {
			return command.eventId().trim();
		}
		if (hasText(command.idempotencyKey())) {
			return command.idempotencyKey().trim();
		}
		return null;
	}

	private String normalize(String providerKey) {
		return providerKey == null ? "" : providerKey.trim().toUpperCase(Locale.ROOT);
	}

	private boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	public record PaymentUpdateResult(PublicPayment payment, boolean shouldConfirmBooking) {}
}
