package com.COP_Escalable.Backend.analytics.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.analytics")
public record AnalyticsProperties(
		int cacheTtlSeconds,
		int kpiTtlSeconds,
		int trendTtlSeconds,
		int distributionTtlSeconds,
		int doctorsTtlSeconds,
		int heatmapTtlSeconds
) {
	public AnalyticsProperties {
		cacheTtlSeconds = Math.max(0, cacheTtlSeconds);
		kpiTtlSeconds = kpiTtlSeconds < 0 ? cacheTtlSeconds : kpiTtlSeconds;
		trendTtlSeconds = trendTtlSeconds < 0 ? cacheTtlSeconds : trendTtlSeconds;
		distributionTtlSeconds = distributionTtlSeconds < 0 ? cacheTtlSeconds : distributionTtlSeconds;
		doctorsTtlSeconds = doctorsTtlSeconds < 0 ? cacheTtlSeconds : doctorsTtlSeconds;
		heatmapTtlSeconds = heatmapTtlSeconds < 0 ? cacheTtlSeconds : heatmapTtlSeconds;
	}
}
