package com.COP_Escalable.Backend.publicbooking.application;

import java.time.Instant;
import java.util.UUID;

public record PublicPaymentPaidEvent(
		UUID organizationId,
		UUID siteId,
		UUID paymentId,
		UUID bookingId,
		UUID professionalId,
		Instant appointmentStartAt,
		Instant appointmentEndAt,
		long amountCents,
		String currency,
		Instant paidAt
) {}
