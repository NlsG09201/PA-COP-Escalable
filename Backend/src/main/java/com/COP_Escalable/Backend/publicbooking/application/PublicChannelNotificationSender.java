package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;

public interface PublicChannelNotificationSender {
	PublicNotificationLog.Channel channel();

	PublicNotificationAdapter.DispatchResult send(PublicNotificationAdapter.BookingConfirmationNotification notification);
}
