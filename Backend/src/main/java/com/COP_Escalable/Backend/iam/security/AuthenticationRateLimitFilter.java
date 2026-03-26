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

/**
 * Brute-force mitigation for public auth endpoints (OWASP A07).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AuthenticationRateLimitFilter extends OncePerRequestFilter {

	private final SecurityHardeningProperties hardening;
	private final RedisAuthenticationRateLimiter limiter;
	private final ClientIpResolver clientIpResolver;
	private final ObjectMapper objectMapper;

	public AuthenticationRateLimitFilter(
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
		String path = request.getRequestURI();
		String method = request.getMethod();
		if (!"POST".equalsIgnoreCase(method)) {
			return true;
		}
		return !(path.endsWith("/api/auth/login") || path.endsWith("/api/auth/refresh"));
	}

	@Override
	protected void doFilterInternal(
			@NonNull HttpServletRequest request,
			@NonNull HttpServletResponse response,
			@NonNull FilterChain filterChain
	) throws ServletException, IOException {
		String ip = clientIpResolver.resolve(request);
		String bucket;
		int max;
		if (request.getRequestURI().endsWith("/api/auth/login")) {
			bucket = "login";
			max = hardening.loginRateLimitPerMinute();
		} else {
			bucket = "refresh";
			max = hardening.refreshRateLimitPerMinute();
		}
		if (!limiter.allow(bucket, ip, max)) {
			byte[] body = objectMapper.writeValueAsBytes(Map.of(
					"error", "rate_limited",
					"message", "Too many authentication attempts. Try again later."
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
