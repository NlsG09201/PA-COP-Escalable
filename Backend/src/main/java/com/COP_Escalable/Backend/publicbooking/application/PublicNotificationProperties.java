package com.COP_Escalable.Backend.publicbooking.application;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.public-booking.notifications")
public record PublicNotificationProperties(
		ChannelSettings email,
		ChannelSettings whatsapp
) {
	public PublicNotificationProperties {
		email = normalize(email, "booking-confirmation-email");
		whatsapp = normalize(whatsapp, "booking-confirmation-whatsapp");
	}

	public ChannelSettings channel(PublicNotificationLog.Channel channel) {
		return switch (channel) {
			case EMAIL -> email;
			case WHATSAPP -> whatsapp;
		};
	}

	public String templateCodeFor(PublicNotificationLog.Channel channel) {
		return channel(channel).templateCode();
	}

	private static ChannelSettings normalize(ChannelSettings settings, String defaultTemplateCode) {
		if (settings == null) {
			return new ChannelSettings(true, defaultTemplateCode);
		}
		return new ChannelSettings(
				settings.enabled() == null ? true : settings.enabled(),
				hasText(settings.templateCode()) ? settings.templateCode() : defaultTemplateCode
		);
	}

	private static boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	public record ChannelSettings(
			Boolean enabled,
			String templateCode
	) {}
}
