package com.COP_Escalable.Backend.iam.service;

import com.COP_Escalable.Backend.iam.config.SecurityProperties;
import com.COP_Escalable.Backend.iam.domain.RefreshToken;
import com.COP_Escalable.Backend.iam.infrastructure.RefreshTokenRepository;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
public class TokenService {
	private static final Duration ACCESS_TTL = Duration.ofMinutes(15);
	private static final Duration REFRESH_TTL = Duration.ofDays(7);
	private static final SecureRandom RNG = new SecureRandom();

	private final JwtEncoder jwtEncoder;
	private final SecurityProperties securityProperties;
	private final RefreshTokenRepository refreshTokens;

	public TokenService(JwtEncoder jwtEncoder, SecurityProperties securityProperties, RefreshTokenRepository refreshTokens) {
		this.jwtEncoder = jwtEncoder;
		this.securityProperties = securityProperties;
		this.refreshTokens = refreshTokens;
	}

	public record TokenPair(String accessToken, Instant accessTokenExpiresAt, String refreshToken, Instant refreshTokenExpiresAt) {}

	@Transactional
	public TokenPair issueFor(CopUserPrincipal principal, java.util.UUID siteId, String ip, String userAgent) {
		Instant now = Instant.now();
		Instant accessExp = now.plus(ACCESS_TTL);

		var claims = JwtClaimsSet.builder()
				.issuer(securityProperties.issuer())
				.subject(principal.getUsername())
				.issuedAt(now)
				.expiresAt(accessExp)
				.claim("user_id", principal.userId().toString())
				.claim("organization_id", principal.organizationId().toString())
				.claim("site_id", siteId == null ? null : siteId.toString())
				.claim("roles", principal.roles().stream().map(Enum::name).toList())
				.build();

		String access = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

		String refreshPlain = generateRefreshToken();
		String refreshHash = sha256Base64Url(refreshPlain);
		Instant refreshExp = now.plus(REFRESH_TTL);

		refreshTokens.save(RefreshToken.issue(principal.organizationId(), siteId, principal.userId(), refreshHash, now, refreshExp, ip, userAgent));
		return new TokenPair(access, accessExp, refreshPlain, refreshExp);
	}

	@Transactional
	public TokenPair rotateRefresh(String refreshTokenPlain, String ip, String userAgent, java.util.function.Function<java.util.UUID, CopUserPrincipal> principalLoader) {
		Instant now = Instant.now();
		String hash = sha256Base64Url(refreshTokenPlain);
		var existing = refreshTokens.findByTokenHash(hash).orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));
		if (!existing.isActive(now)) {
			throw new IllegalArgumentException("Refresh token expired or revoked");
		}

		var principal = principalLoader.apply(existing.getUserId());
		var newPair = issueFor(principal, existing.getSiteId(), ip, userAgent);
		existing.revoke(now, null);
		refreshTokens.save(existing);
		return newPair;
	}

	private static String generateRefreshToken() {
		byte[] b = new byte[32];
		RNG.nextBytes(b);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
	}

	private static String sha256Base64Url(String value) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
		} catch (Exception e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}
}

