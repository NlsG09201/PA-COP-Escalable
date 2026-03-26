package com.COP_Escalable.Backend.iam.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Production-oriented security toggles (see application.yml / env).
 */
@ConfigurationProperties(prefix = "app.security.hardening")
public record SecurityHardeningProperties(
		@DefaultValue("true") boolean exposeApiDocumentation,
		@DefaultValue("30") int loginRateLimitPerMinute,
		@DefaultValue("60") int refreshRateLimitPerMinute,
		@DefaultValue("30") int mfaVerifyRateLimitPerMinute,
		@DefaultValue("10") int mfaSetupRateLimitPerMinute,
		/**
		 * When true, {@code X-Forwarded-For} is trusted for client IP (place behind a trusted reverse proxy only).
		 */
		@DefaultValue("false") boolean trustForwardedHeaders,
		/**
		 * When true, sends HSTS (only meaningful behind TLS termination).
		 */
		@DefaultValue("false") boolean enableHsts,
		@DefaultValue("31536000") long hstsMaxAgeSeconds
) {}
