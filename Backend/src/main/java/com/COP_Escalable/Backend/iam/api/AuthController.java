package com.COP_Escalable.Backend.iam.api;

import com.COP_Escalable.Backend.iam.security.ClientIpResolver;
import com.COP_Escalable.Backend.iam.mfa.MfaTotpService;
import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import com.COP_Escalable.Backend.iam.service.MfaStepUpRequiredException;
import com.COP_Escalable.Backend.iam.service.PrincipalService;
import com.COP_Escalable.Backend.iam.service.TokenService;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	private final AuthenticationManager authenticationManager;
	private final TokenService tokens;
	private final PrincipalService principals;
	private final SiteRepository sites;
	private final ClientIpResolver clientIpResolver;
	private final MfaTotpService mfa;

	public AuthController(
			AuthenticationManager authenticationManager,
			TokenService tokens,
			PrincipalService principals,
			SiteRepository sites,
			ClientIpResolver clientIpResolver,
			MfaTotpService mfa
	) {
		this.authenticationManager = authenticationManager;
		this.tokens = tokens;
		this.principals = principals;
		this.sites = sites;
		this.clientIpResolver = clientIpResolver;
		this.mfa = mfa;
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

		return tokens.issueFor(principal, siteId, clientIpResolver.resolve(httpReq), userAgent(httpReq));
	}

	@PostMapping("/refresh")
	public TokenService.TokenPair refresh(@Valid @RequestBody RefreshRequest req, HttpServletRequest httpReq) {
		try {
			return tokens.rotateRefresh(req.refreshToken(), clientIpResolver.resolve(httpReq), userAgent(httpReq), principals::requireById);
		} catch (MfaStepUpRequiredException e) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
		}
	}

	@PostMapping("/mfa/setup")
	public MfaTotpService.MfaSetupStartResponse setup(@AuthenticationPrincipal Jwt jwt) {
		if (jwt == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing JWT authentication");
		}
		UUID userId = UUID.fromString(jwt.getClaimAsString("user_id"));
		return mfa.startSetup(userId);
	}

	@PostMapping("/mfa/verify")
	public TokenService.TokenPair verify(
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody VerifyMfaRequest req,
			HttpServletRequest httpReq
	) {
		if (jwt == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing JWT authentication");
		}
		String userIdRaw = jwt.getClaimAsString("user_id");
		String siteIdRaw = jwt.getClaimAsString("site_id");
		if (userIdRaw == null || siteIdRaw == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid JWT claims for MFA");
		}

		UUID userId = UUID.fromString(userIdRaw);
		UUID siteId = UUID.fromString(siteIdRaw);
		return mfa.verifyAndEnable(
				userId,
				siteId,
				req.code(),
				clientIpResolver.resolve(httpReq),
				userAgent(httpReq)
		);
	}

	public record LoginRequest(
			@NotBlank String username,
			@NotBlank String password,
			@NotNull UUID siteId
	) {}

	public record RefreshRequest(@NotBlank String refreshToken) {}

	public record VerifyMfaRequest(
			@Pattern(regexp = "^\\d{6}$", message = "MFA code must be a 6-digit number")
			String code
	) {}

	private static String userAgent(HttpServletRequest req) {
		return req.getHeader("User-Agent");
	}
}

