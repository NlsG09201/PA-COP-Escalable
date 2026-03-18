package com.COP_Escalable.Backend.publicbooking.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Locale;

@ConfigurationProperties(prefix = "app.public-booking.payments")
public record PublicPaymentProperties(
		String defaultProvider,
		Sandbox sandbox
) {
	public PublicPaymentProperties {
		defaultProvider = normalizeProvider(defaultProvider);
		sandbox = sandbox == null ? new Sandbox(null) : sandbox;
	}

	public String resolveProvider(String requestedProvider) {
		return hasText(requestedProvider) ? normalizeProvider(requestedProvider) : defaultProvider;
	}

	private static String normalizeProvider(String providerKey) {
		return hasText(providerKey) ? providerKey.trim().toUpperCase(Locale.ROOT) : "SANDBOX";
	}

	private static boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	public record Sandbox(String checkoutBaseUrl) {}
}
