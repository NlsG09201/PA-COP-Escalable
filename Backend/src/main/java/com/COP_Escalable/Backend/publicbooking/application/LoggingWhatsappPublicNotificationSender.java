package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingWhatsappPublicNotificationSender implements PublicChannelNotificationSender {
	private static final Logger log = LoggerFactory.getLogger(LoggingWhatsappPublicNotificationSender.class);

	@Override
	public PublicNotificationLog.Channel channel() {
		return PublicNotificationLog.Channel.WHATSAPP;
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

		String messageId = "simulated-whatsapp-" + notification.bookingId() + "-attempt-" + notification.attemptCount();
		log.info(
				"Public booking WhatsApp confirmation sent to {} for booking {} using template {} with payload {}",
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
