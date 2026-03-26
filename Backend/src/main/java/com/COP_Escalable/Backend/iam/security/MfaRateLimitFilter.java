package com.COP_Escalable.Backend.iam.security;

import com.COP_Escalable.Backend.iam.config.SecurityHardeningProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class MfaRateLimitFilter extends OncePerRequestFilter {

	private final SecurityHardeningProperties hardening;
	private final RedisAuthenticationRateLimiter limiter;
	private final ClientIpResolver clientIpResolver;
	private final ObjectMapper objectMapper;

	public MfaRateLimitFilter(
			SecurityHardeningProperties hardening,
			RedisAuthenticationRateLimiter limiter,
			ClientIpResolver clientIpResolver,
			ObjectMapper objectMapper
	) {
		this.hardening = hardening;
		this.limiter = limiter;
		this.clientIpResolver = clientIpResolver;
		this.objectMapper = objectMapper;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		if (!"POST".equalsIgnoreCase(request.getMethod())) {
			return true;
		}
		String path = request.getRequestURI();
		return !(path.equals("/api/auth/mfa/setup") || path.equals("/api/auth/mfa/verify"));
	}

	@Override
	protected void doFilterInternal(
			@NonNull HttpServletRequest request,
			@NonNull HttpServletResponse response,
			@NonNull FilterChain filterChain
	) throws ServletException, IOException {
		String ip = clientIpResolver.resolve(request);
		String path = request.getRequestURI();

		String bucket;
		int maxPerMinute;
		if (path.equals("/api/auth/mfa/setup")) {
			bucket = "mfa-setup";
			maxPerMinute = hardening.mfaSetupRateLimitPerMinute();
		} else {
			bucket = "mfa-verify";
			maxPerMinute = hardening.mfaVerifyRateLimitPerMinute();
		}

		if (!limiter.allow(bucket, ip, maxPerMinute)) {
			byte[] body = objectMapper.writeValueAsBytes(Map.of(
					"error", "rate_limited",
					"message", "Too many MFA attempts. Try again later."
			));
			response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setContentLength(body.length);
			response.getOutputStream().write(body);
			return;
		}

		filterChain.doFilter(request, response);
	}
}

