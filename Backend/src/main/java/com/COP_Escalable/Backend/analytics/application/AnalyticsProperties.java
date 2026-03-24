package com.COP_Escalable.Backend.analytics.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.analytics")
public record AnalyticsProperties(
		int cacheTtlSeconds
) {
	public AnalyticsProperties {
		if (cacheTtlSeconds < 0) {
			throw new IllegalArgumentException("cacheTtlSeconds must be >= 0");
		}
	}
}
