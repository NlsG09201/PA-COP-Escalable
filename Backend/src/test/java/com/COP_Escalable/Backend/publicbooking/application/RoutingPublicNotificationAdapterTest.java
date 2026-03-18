package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RoutingPublicNotificationAdapterTest {

	@Test
	void routesDeliveryToMatchingChannelSender() {
		var emailSender = new StubSender(PublicNotificationLog.Channel.EMAIL, PublicNotificationLog.Status.SENT);
		var adapter = new RoutingPublicNotificationAdapter(
				List.of(emailSender),
				new PublicNotificationProperties(
						new PublicNotificationProperties.ChannelSettings(true, "booking-confirmation-email"),
						new PublicNotificationProperties.ChannelSettings(true, "booking-confirmation-whatsapp")
				)
		);

		var result = adapter.sendBookingConfirmation(notification(PublicNotificationLog.Channel.EMAIL));

		assertEquals(PublicNotificationLog.Status.SENT, result.status());
		assertEquals(1, emailSender.calls);
	}

	@Test
	void skipsDeliveryWhenChannelIsDisabled() {
		var emailSender = new StubSender(PublicNotificationLog.Channel.EMAIL, PublicNotificationLog.Status.SENT);
		var adapter = new RoutingPublicNotificationAdapter(
				List.of(emailSender),
				new PublicNotificationProperties(
						new PublicNotificationProperties.ChannelSettings(false, "booking-confirmation-email"),
						new PublicNotificationProperties.ChannelSettings(true, "booking-confirmation-whatsapp")
				)
		);

		var result = adapter.sendBookingConfirmation(notification(PublicNotificationLog.Channel.EMAIL));

		assertEquals(PublicNotificationLog.Status.SKIPPED, result.status());
		assertEquals("Channel EMAIL is disabled", result.errorMessage());
		assertEquals(0, emailSender.calls);
	}

	@Test
	void skipsDeliveryWhenNoSenderIsConfigured() {
		var adapter = new RoutingPublicNotificationAdapter(
				List.of(),
				new PublicNotificationProperties(
						new PublicNotificationProperties.ChannelSettings(true, "booking-confirmation-email"),
						new PublicNotificationProperties.ChannelSettings(true, "booking-confirmation-whatsapp")
				)
		);

		var result = adapter.sendBookingConfirmation(notification(PublicNotificationLog.Channel.WHATSAPP));

		assertEquals(PublicNotificationLog.Status.SKIPPED, result.status());
		assertEquals("No sender configured for channel WHATSAPP", result.errorMessage());
		assertNull(result.providerMessageId());
	}

	private static PublicNotificationAdapter.BookingConfirmationNotification notification(PublicNotificationLog.Channel channel) {
		return new PublicNotificationAdapter.BookingConfirmationNotification(
				UUID.randomUUID(),
				UUID.randomUUID(),
				UUID.randomUUID(),
				channel,
				channel == PublicNotificationLog.Channel.EMAIL ? "patient@example.com" : "+573001112233",
				"booking-confirmation",
				"{\"patientName\":\"Pat Doe\"}",
				1
		);
	}

	private static final class StubSender implements PublicChannelNotificationSender {
		private final PublicNotificationLog.Channel channel;
		private final PublicNotificationLog.Status status;
		private int calls;

		private StubSender(PublicNotificationLog.Channel channel, PublicNotificationLog.Status status) {
			this.channel = channel;
			this.status = status;
		}

		@Override
		public PublicNotificationLog.Channel channel() {
			return channel;
		}

		@Override
		public PublicNotificationAdapter.DispatchResult send(PublicNotificationAdapter.BookingConfirmationNotification notification) {
			calls++;
			return new PublicNotificationAdapter.DispatchResult(status, "provider-message-id", null);
		}
	}
}
