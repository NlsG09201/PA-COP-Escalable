package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
public class SandboxPublicPaymentProvider implements PublicPaymentProvider {
	private final PublicPaymentProperties properties;

	public SandboxPublicPaymentProvider(PublicPaymentProperties properties) {
		this.properties = properties;
	}

	@Override
	public String key() {
		return "SANDBOX";
	}

	@Override
	public PaymentIntent createIntent(CreatePaymentIntentCommand command) {
		var providerReference = "sandbox-" + command.bookingId() + "-" + UUID.randomUUID();
		var checkoutUrl = buildCheckoutUrl(command.bookingId(), providerReference);
		var clientSecret = "sandbox_" + UUID.nameUUIDFromBytes(
				(providerReference + ":" + command.amount()).getBytes(StandardCharsets.UTF_8)
		);
		return new PaymentIntent(
				providerReference,
				"REQUIRES_ACTION",
				PublicPayment.Status.REQUIRES_ACTION,
				checkoutUrl,
				clientSecret,
				command.expiresAt()
		);
	}

	@Override
	public WebhookResolution resolveWebhook(WebhookPayload payload) {
		var rawStatus = payload.rawStatus() == null ? "" : payload.rawStatus().trim();
		if (matches(rawStatus, "approved", "paid", "success", "succeeded")) {
			return new WebhookResolution(payload.providerReference(), rawStatus, PublicPayment.Status.PAID, null);
		}
		if (matches(rawStatus, "pending", "processing", "in_process")) {
			return new WebhookResolution(payload.providerReference(), rawStatus, PublicPayment.Status.PROCESSING, null);
		}
		if (matches(rawStatus, "requires_action", "requires-payment-method", "open")) {
			return new WebhookResolution(payload.providerReference(), rawStatus, PublicPayment.Status.REQUIRES_ACTION, null);
		}
		if (matches(rawStatus, "cancelled", "canceled")) {
			return new WebhookResolution(payload.providerReference(), rawStatus, PublicPayment.Status.CANCELLED, "Payment was cancelled");
		}
		if (matches(rawStatus, "expired")) {
			return new WebhookResolution(payload.providerReference(), rawStatus, PublicPayment.Status.EXPIRED, "Payment intent expired");
		}
		return new WebhookResolution(
				payload.providerReference(),
				rawStatus.isBlank() ? "FAILED" : rawStatus,
				PublicPayment.Status.FAILED,
				"Payment was rejected by provider"
		);
	}

	private String buildCheckoutUrl(UUID bookingId, String providerReference) {
		var baseUrl = properties.sandbox().checkoutBaseUrl();
		if (baseUrl == null || baseUrl.isBlank()) {
			return null;
		}
		var normalizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
		return normalizedBase + "/public/payments/sandbox/" + bookingId + "?intent=" + providerReference;
	}

	private boolean matches(String value, String... candidates) {
		for (String candidate : candidates) {
			if (candidate.equalsIgnoreCase(value)) {
				return true;
			}
		}
		return false;
	}
}
