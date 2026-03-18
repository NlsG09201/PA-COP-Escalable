package com.COP_Escalable.Backend.iam.api;

import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import com.COP_Escalable.Backend.iam.service.PrincipalService;
import com.COP_Escalable.Backend.iam.service.TokenService;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	private final AuthenticationManager authenticationManager;
	private final TokenService tokens;
	private final PrincipalService principals;
	private final SiteRepository sites;

	public AuthController(AuthenticationManager authenticationManager, TokenService tokens, PrincipalService principals, SiteRepository sites) {
		this.authenticationManager = authenticationManager;
		this.tokens = tokens;
		this.principals = principals;
		this.sites = sites;
	}

	@PostMapping("/login")
	public TokenService.TokenPair login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpReq) {
		Authentication auth = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(req.username().trim().toLowerCase(), req.password())
		);
		if (!(auth.getPrincipal() instanceof CopUserPrincipal principal)) {
			throw new IllegalStateException("Unexpected principal type");
		}

		UUID siteId = req.siteId();
		sites.findByIdAndOrganizationId(siteId, principal.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Invalid site for organization"));

		return tokens.issueFor(principal, siteId, ip(httpReq), userAgent(httpReq));
	}

	@PostMapping("/refresh")
	public TokenService.TokenPair refresh(@Valid @RequestBody RefreshRequest req, HttpServletRequest httpReq) {
		return tokens.rotateRefresh(req.refreshToken(), ip(httpReq), userAgent(httpReq), principals::requireById);
	}

	public record LoginRequest(
			@NotBlank String username,
			@NotBlank String password,
			@NotNull UUID siteId
	) {}

	public record RefreshRequest(@NotBlank String refreshToken) {}

	private static String ip(HttpServletRequest req) {
		String xf = req.getHeader("X-Forwarded-For");
		if (xf != null && !xf.isBlank()) {
			return xf.split(",")[0].trim();
		}
		return req.getRemoteAddr();
	}

	private static String userAgent(HttpServletRequest req) {
		return req.getHeader("User-Agent");
	}
}

