package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import com.COP_Escalable.Backend.publicbooking.infrastructure.PublicPaymentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicPaymentServiceTest {
	@Mock
	private PublicPaymentRepository payments;

	private final PublicPaymentProvider sandboxProvider = new SandboxPublicPaymentProvider(
			new PublicPaymentProperties("SANDBOX", new PublicPaymentProperties.Sandbox("http://localhost:4200"))
	);

	@Test
	void reusesExistingIntentForSameProviderAndIdempotencyKey() {
		var service = service();
		var booking = booking();
		var existing = payment(booking, "SANDBOX", "idem-123");

		when(payments.findFirstByBookingIdAndProviderKeyAndIdempotencyKeyOrderByCreatedAtDesc(
				eq(booking.getId()),
				eq("SANDBOX"),
				eq("idem-123")
		)).thenReturn(Optional.of(existing));

		var result = service.createIntent(booking, null, "idem-123", "/booking/confirmation/" + booking.getId());

		assertSame(existing, result);
		verify(payments, never()).save(any(PublicPayment.class));
	}

	@Test
	void usesEventIdBeforeIdempotencyKeyForWebhookDeduplication() {
		var service = service();
		var booking = booking();
		var payment = payment(booking, "SANDBOX", "idem-123");
		payment.rememberWebhookIdempotencyKey("evt-001");

		var duplicate = service.isDuplicateWebhook(payment, new PublicBookingService.PaymentWebhookCommand(
				booking.getId(),
				"SANDBOX",
				payment.getProviderReference(),
				"approved",
				"evt-001",
				"idem-999"
		));
		var notDuplicate = service.isDuplicateWebhook(payment, new PublicBookingService.PaymentWebhookCommand(
				booking.getId(),
				"SANDBOX",
				payment.getProviderReference(),
				"approved",
				"evt-002",
				"idem-999"
		));

		assertTrue(duplicate);
		assertFalse(notDuplicate);
	}

	@Test
	void appliesWebhookUsingProviderSpecificStatusMapping() {
		var service = service();
		var booking = booking();
		var payment = payment(booking, "SANDBOX", "idem-123");

		when(payments.save(any(PublicPayment.class))).thenAnswer(invocation -> invocation.getArgument(0));

		var result = service.applyWebhook(payment, new PublicBookingService.PaymentWebhookCommand(
				booking.getId(),
				"SANDBOX",
				payment.getProviderReference(),
				"processing",
				"evt-101",
				"idem-123"
		));

		assertEquals(PublicPayment.Status.PROCESSING, result.payment().getStatus());
		assertFalse(result.shouldConfirmBooking());
		assertEquals("evt-101", result.payment().getLastWebhookIdempotencyKey());
	}

	private static PublicBooking booking() {
		return PublicBooking.createPendingPayment(
				UUID.randomUUID(),
				UUID.randomUUID(),
				"general-dentistry",
				"Valoracion dental integral",
				"Odontologia",
				"Pat Doe",
				"pat@example.com",
				"+573001112233",
				null,
				95000L,
				Instant.parse("2026-03-20T15:00:00Z"),
				Instant.parse("2026-03-20T15:45:00Z"),
				Instant.parse("2026-03-20T15:15:00Z"),
				UUID.randomUUID()
		);
	}

	private static PublicPayment payment(PublicBooking booking, String providerKey, String idempotencyKey) {
		return PublicPayment.create(
				booking.getOrganizationId(),
				booking.getSiteId(),
				booking.getId(),
				providerKey,
				"sandbox-" + booking.getId(),
				"REQUIRES_ACTION",
				PublicPayment.Status.REQUIRES_ACTION,
				booking.getQuotedPrice(),
				"COP",
				idempotencyKey,
				booking.getExpiresAt(),
				"http://localhost:4200/public/payments/sandbox/" + booking.getId(),
				"sandbox_secret"
		);
	}

	private PublicPaymentService service() {
		return new PublicPaymentService(
				payments,
				List.of(sandboxProvider),
				new PublicPaymentProperties("SANDBOX", new PublicPaymentProperties.Sandbox("http://localhost:4200"))
		);
	}
}
