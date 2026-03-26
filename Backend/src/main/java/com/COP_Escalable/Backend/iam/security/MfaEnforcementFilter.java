package com.COP_Escalable.Backend.iam.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * Blocks access to the application APIs when the user has MFA enabled but has not yet verified it.
 *
 * We rely on JWT claims minted by {@link com.COP_Escalable.Backend.iam.service.TokenService}:
 * - {@code mfa_enabled}: boolean
 * - {@code mfa_verified}: boolean
 */
@Component
public class MfaEnforcementFilter extends OncePerRequestFilter {

	private static final String CLAIM_MFA_VERIFIED = "mfa_verified";

	private static final String[] ALLOWED_WHEN_MFA_PENDING = {
			"/api/auth/login",
			"/api/auth/refresh",
			"/api/auth/mfa/setup",
			"/api/auth/mfa/verify"
	};

	private final ObjectMapper objectMapper;

	public MfaEnforcementFilter(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, jakarta.servlet.FilterChain filterChain)
			throws jakarta.servlet.ServletException, IOException {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
			filterChain.doFilter(request, response);
			return;
		}

		var jwt = jwtAuth.getToken();
		Boolean verified = jwt.getClaimAsBoolean(CLAIM_MFA_VERIFIED);
		if (verified == null || verified) {
			filterChain.doFilter(request, response);
			return;
		}

		String path = request.getRequestURI();
		boolean allowed = pathMatches(path, ALLOWED_WHEN_MFA_PENDING)
				|| path.startsWith("/actuator/health")
				|| path.equals("/actuator/info")
				|| path.startsWith("/actuator/prometheus");

		if (allowed) {
			filterChain.doFilter(request, response);
			return;
		}

		response.setStatus(403);
		response.setContentType("application/json");
		byte[] body = objectMapper.writeValueAsBytes(Map.of(
				"error", "mfa_required",
				"message", "MFA verification is required to access this endpoint"
		));
		response.setContentLength(body.length);
		response.getOutputStream().write(body);
	}

	private static boolean pathMatches(String requestPath, String[] allowedExact) {
		for (String p : allowedExact) {
			if (requestPath.equals(p) || requestPath.startsWith(p + "/")) {
				return true;
			}
		}
		return false;
	}
}

