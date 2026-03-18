package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingPublicNotificationAdapter implements PublicChannelNotificationSender {
	private static final Logger log = LoggerFactory.getLogger(LoggingPublicNotificationAdapter.class);

	@Override
	public PublicNotificationLog.Channel channel() {
		return PublicNotificationLog.Channel.EMAIL;
	}

	@Override
	public PublicNotificationAdapter.DispatchResult send(PublicNotificationAdapter.BookingConfirmationNotification notification) {
		String recipient = notification.recipient();
		if (recipient == null || recipient.isBlank()) {
			return new PublicNotificationAdapter.DispatchResult(
					PublicNotificationLog.Status.SKIPPED,
					null,
					"Recipient is missing for channel " + channel().name()
			);
		}

		String messageId = "simulated-email-" + notification.bookingId() + "-attempt-" + notification.attemptCount();
		log.info(
				"Public booking email confirmation sent to {} for booking {} using template {} with payload {}",
				recipient,
				notification.bookingId(),
				notification.templateCode(),
				notification.templatePayload()
		);
		return new PublicNotificationAdapter.DispatchResult(
				PublicNotificationLog.Status.SENT,
				messageId,
				null
		);
	}
}
