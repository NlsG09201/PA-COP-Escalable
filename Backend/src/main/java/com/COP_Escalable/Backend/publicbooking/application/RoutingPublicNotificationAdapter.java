package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class RoutingPublicNotificationAdapter implements PublicNotificationAdapter {
	private final Map<PublicNotificationLog.Channel, PublicChannelNotificationSender> senders;
	private final PublicNotificationProperties properties;

	public RoutingPublicNotificationAdapter(
			List<PublicChannelNotificationSender> senders,
			PublicNotificationProperties properties
	) {
		this.properties = properties;
		this.senders = new EnumMap<>(PublicNotificationLog.Channel.class);
		for (var sender : senders) {
			var previous = this.senders.put(sender.channel(), sender);
			if (previous != null) {
				throw new IllegalStateException("Duplicate notification sender for channel " + sender.channel().name());
			}
		}
	}

	@Override
	public DispatchResult sendBookingConfirmation(BookingConfirmationNotification notification) {
		var settings = properties.channel(notification.channel());
		if (!settings.enabled()) {
			return new DispatchResult(
					PublicNotificationLog.Status.SKIPPED,
					null,
					"Channel " + notification.channel().name() + " is disabled"
			);
		}

		var sender = senders.get(notification.channel());
		if (sender == null) {
			return new DispatchResult(
					PublicNotificationLog.Status.SKIPPED,
					null,
					"No sender configured for channel " + notification.channel().name()
			);
		}
		return sender.send(notification);
	}
}
