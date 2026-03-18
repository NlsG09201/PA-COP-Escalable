package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;

public interface PublicNotificationAdapter {
	DispatchResult sendBookingConfirmation(BookingConfirmationNotification notification);

	record BookingConfirmationNotification(
			java.util.UUID organizationId,
			java.util.UUID siteId,
			java.util.UUID bookingId,
			PublicNotificationLog.Channel channel,
			String recipient,
			String templateCode,
			String templatePayload,
			int attemptCount
	) {}

	record DispatchResult(
			PublicNotificationLog.Status status,
			String providerMessageId,
			String errorMessage
	) {}
}
