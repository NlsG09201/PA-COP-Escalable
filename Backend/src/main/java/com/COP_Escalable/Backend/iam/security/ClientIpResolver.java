package com.COP_Escalable.Backend.iam.security;

import com.COP_Escalable.Backend.iam.config.SecurityHardeningProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Resolves client IP without trusting {@code X-Forwarded-For} unless explicitly configured
 * (prevents IP spoofing for rate limiting / audit when the app is not behind a trusted proxy).
 */
@Component
public class ClientIpResolver {

	private final SecurityHardeningProperties hardening;

	public ClientIpResolver(SecurityHardeningProperties hardening) {
		this.hardening = hardening;
	}

	public String resolve(HttpServletRequest req) {
		if (hardening.trustForwardedHeaders()) {
			String xf = req.getHeader("X-Forwarded-For");
			if (xf != null && !xf.isBlank()) {
				return xf.split(",")[0].trim();
			}
		}
		return req.getRemoteAddr();
	}
}
