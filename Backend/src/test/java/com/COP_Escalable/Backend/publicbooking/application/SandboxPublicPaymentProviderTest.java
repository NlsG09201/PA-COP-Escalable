package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SandboxPublicPaymentProviderTest {

	@Test
	void createsSandboxIntentWithCheckoutUrlAndClientSecret() {
		var provider = new SandboxPublicPaymentProvider(
				new PublicPaymentProperties("sandbox", new PublicPaymentProperties.Sandbox("http://localhost:4200"))
		);

		var intent = provider.createIntent(new PublicPaymentProvider.CreatePaymentIntentCommand(
				UUID.randomUUID(),
				UUID.randomUUID(),
				UUID.randomUUID(),
				"Valoracion dental integral",
				"Pat Doe",
				"pat@example.com",
				"+573001112233",
				95000L,
				"COP",
				Instant.parse("2026-03-18T12:00:00Z"),
				"idem-123",
				"/booking/confirmation/test"
		));

		assertEquals(PublicPayment.Status.REQUIRES_ACTION, intent.paymentStatus());
		assertEquals("REQUIRES_ACTION", intent.providerStatus());
		assertNotNull(intent.clientSecret());
		assertTrue(intent.providerReference().startsWith("sandbox-"));
		assertTrue(intent.checkoutUrl().startsWith("http://localhost:4200/public/payments/sandbox/"));
	}

	@Test
	void mapsWebhookStatusesToProviderAgnosticPaymentStates() {
		var provider = new SandboxPublicPaymentProvider(
				new PublicPaymentProperties("SANDBOX", new PublicPaymentProperties.Sandbox(null))
		);

		var approved = provider.resolveWebhook(new PublicPaymentProvider.WebhookPayload(
				UUID.randomUUID(),
				"sandbox-ref",
				"approved",
				"evt-1",
				null
		));
		var processing = provider.resolveWebhook(new PublicPaymentProvider.WebhookPayload(
				UUID.randomUUID(),
				"sandbox-ref",
				"processing",
				"evt-2",
				null
		));
		var cancelled = provider.resolveWebhook(new PublicPaymentProvider.WebhookPayload(
				UUID.randomUUID(),
				"sandbox-ref",
				"cancelled",
				"evt-3",
				null
		));

		assertEquals(PublicPayment.Status.PAID, approved.paymentStatus());
		assertEquals(PublicPayment.Status.PROCESSING, processing.paymentStatus());
		assertEquals(PublicPayment.Status.CANCELLED, cancelled.paymentStatus());
		assertEquals("Payment was cancelled", cancelled.failureReason());
	}
}
