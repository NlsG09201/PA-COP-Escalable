package com.COP_Escalable.Backend.notifications.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.UUID;

@ConfigurationProperties(prefix = "app.notifications")
public record NotificationProperties(
		Redis redis,
		Retry retry,
		Reminder reminder,
		Email email,
		Whatsapp whatsapp
) {
	public NotificationProperties {
		redis = redis == null ? Redis.defaults() : redis.normalized();
		retry = retry == null ? Retry.defaults() : retry.normalized();
		reminder = reminder == null ? Reminder.defaults() : reminder.normalized();
		email = email == null ? Email.defaults() : email.normalized();
		whatsapp = whatsapp == null ? Whatsapp.defaults() : whatsapp.normalized();
	}

	public record Redis(
			String stream,
			String consumerGroup,
			String consumerName,
			Integer batchSize,
			Long relayPollDelayMs,
			Long consumerPollDelayMs,
			Long retryPollDelayMs,
			Long readBlockMs,
			Long claimIdleTimeMs
	) {
		private static Redis defaults() {
			return new Redis(
					"cop:notifications:appointments",
					"notifications-workers",
					defaultConsumerName(),
					20,
					2000L,
					1000L,
					2000L,
					1000L,
					60000L
			);
		}

		private Redis normalized() {
			var defaults = defaults();
			return new Redis(
					hasText(stream) ? stream : defaults.stream,
					hasText(consumerGroup) ? consumerGroup : defaults.consumerGroup,
					hasText(consumerName) ? consumerName : defaults.consumerName,
					batchSize == null || batchSize < 1 ? defaults.batchSize : batchSize,
					relayPollDelayMs == null || relayPollDelayMs < 100 ? defaults.relayPollDelayMs : relayPollDelayMs,
					consumerPollDelayMs == null || consumerPollDelayMs < 100 ? defaults.consumerPollDelayMs : consumerPollDelayMs,
					retryPollDelayMs == null || retryPollDelayMs < 100 ? defaults.retryPollDelayMs : retryPollDelayMs,
					readBlockMs == null || readBlockMs < 100 ? defaults.readBlockMs : readBlockMs,
					claimIdleTimeMs == null || claimIdleTimeMs < 1000 ? defaults.claimIdleTimeMs : claimIdleTimeMs
			);
		}
	}

	public record Retry(
			Integer maxAttempts,
			Long initialBackoffMs,
			Double multiplier,
			Long maxBackoffMs
	) {
		private static Retry defaults() {
			return new Retry(5, 10000L, 2.0d, 300000L);
		}

		private Retry normalized() {
			var defaults = defaults();
			return new Retry(
					maxAttempts == null || maxAttempts < 1 ? defaults.maxAttempts : maxAttempts,
					initialBackoffMs == null || initialBackoffMs < 1000 ? defaults.initialBackoffMs : initialBackoffMs,
					multiplier == null || multiplier < 1.0d ? defaults.multiplier : multiplier,
					maxBackoffMs == null || maxBackoffMs < 1000 ? defaults.maxBackoffMs : maxBackoffMs
			);
		}
	}

	public record Reminder(
			Boolean enabled,
			Long leadTimeMinutes,
			Long pollDelayMs
	) {
		private static Reminder defaults() {
			return new Reminder(true, 1440L, 60000L);
		}

		private Reminder normalized() {
			var defaults = defaults();
			return new Reminder(
					enabled == null ? defaults.enabled : enabled,
					leadTimeMinutes == null || leadTimeMinutes < 1 ? defaults.leadTimeMinutes : leadTimeMinutes,
					pollDelayMs == null || pollDelayMs < 1000 ? defaults.pollDelayMs : pollDelayMs
			);
		}
	}

	public record Email(
			Boolean enabled,
			String provider,
			String fromAddress,
			String subjectPrefix
	) {
		private static Email defaults() {
			return new Email(true, "LOG", "no-reply@cop.local", "[COP]");
		}

		private Email normalized() {
			var defaults = defaults();
			return new Email(
					enabled == null ? defaults.enabled : enabled,
					hasText(provider) ? provider.trim().toUpperCase(Locale.ROOT) : defaults.provider,
					hasText(fromAddress) ? fromAddress.trim() : defaults.fromAddress,
					hasText(subjectPrefix) ? subjectPrefix.trim() : defaults.subjectPrefix
			);
		}
	}

	public record Whatsapp(
			Boolean enabled,
			String provider,
			String baseUrl,
			String apiToken,
			String phoneNumberId
	) {
		private static Whatsapp defaults() {
			return new Whatsapp(true, "LOG", "https://graph.facebook.com/v23.0", null, null);
		}

		private Whatsapp normalized() {
			var defaults = defaults();
			return new Whatsapp(
					enabled == null ? defaults.enabled : enabled,
					hasText(provider) ? provider.trim().toUpperCase(Locale.ROOT) : defaults.provider,
					hasText(baseUrl) ? baseUrl.trim() : defaults.baseUrl,
					hasText(apiToken) ? apiToken.trim() : defaults.apiToken,
					hasText(phoneNumberId) ? phoneNumberId.trim() : defaults.phoneNumberId
			);
		}
	}

	private static boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	private static String defaultConsumerName() {
		try {
			return "notifications-" + InetAddress.getLocalHost().getHostName() + "-" + UUID.randomUUID();
		} catch (UnknownHostException ex) {
			return "notifications-" + UUID.randomUUID();
		}
	}
}
