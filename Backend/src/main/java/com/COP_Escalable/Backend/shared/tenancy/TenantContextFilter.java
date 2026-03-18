package com.COP_Escalable.Backend.shared.tenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Establishes tenant context for the request from authenticated JWT claims.
 * Claims are expected to be minted by our Authorization Server and are not accepted from client-provided headers.
 */
public class TenantContextFilter extends OncePerRequestFilter {

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		try {
			var auth = Optional.ofNullable(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication());
			auth.flatMap(this::extractTenant).ifPresent(TenantContextHolder::set);
			filterChain.doFilter(request, response);
		} finally {
			TenantContextHolder.clear();
		}
	}

	private Optional<TenantContext> extractTenant(Authentication authentication) {
		if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
			return Optional.empty();
		}
		var jwt = jwtAuth.getToken();
		var orgClaim = jwt.getClaimAsString("organization_id");
		if (orgClaim == null || orgClaim.isBlank()) {
			return Optional.empty();
		}
		var siteClaim = jwt.getClaimAsString("site_id");
		UUID orgId = UUID.fromString(orgClaim);
		UUID siteId = (siteClaim == null || siteClaim.isBlank()) ? null : UUID.fromString(siteClaim);
		return Optional.of(new TenantContext(orgId, siteId));
	}
}

