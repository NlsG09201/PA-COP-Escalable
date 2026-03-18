package com.COP_Escalable.Backend.publicbooking.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PublicPaymentTest {

	@Test
	void appliesWebhookTransitionsWithoutLosingProviderMetadata() {
		var payment = PublicPayment.create(
				UUID.randomUUID(),
				UUID.randomUUID(),
				UUID.randomUUID(),
				"SANDBOX",
				"sandbox-ref",
				"REQUIRES_ACTION",
				PublicPayment.Status.REQUIRES_ACTION,
				95000L,
				"COP",
				"idem-123",
				Instant.parse("2026-03-18T12:00:00Z"),
				"http://localhost:4200/checkout",
				"sandbox_secret"
		);

		payment.applyProviderUpdate("processing", PublicPayment.Status.PROCESSING, null);
		assertEquals(PublicPayment.Status.PROCESSING, payment.getStatus());
		assertEquals("processing", payment.getProviderStatus());

		payment.applyProviderUpdate("approved", PublicPayment.Status.PAID, null);
		assertEquals(PublicPayment.Status.PAID, payment.getStatus());
		assertEquals("approved", payment.getProviderStatus());
		assertNull(payment.getFailureReason());
		assertNull(payment.getExpiresAt());
	}
}
