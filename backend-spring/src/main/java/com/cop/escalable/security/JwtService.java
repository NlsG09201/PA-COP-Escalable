package com.cop.escalable.security;

import com.cop.escalable.config.CopSecurityProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final CopSecurityProperties properties;
  private final Duration ttl;
  public JwtService(CopSecurityProperties properties, Duration accessTokenTtl) { this.properties = properties; this.ttl = accessTokenTtl; }
  public String issue(String username, String userId, String organizationId, String siteId, List<String> roles) {
    Date now = new Date();
    return Jwts.builder().subject(username).claims(Map.of("user_id", userId, "organization_id", organizationId, "site_id", siteId == null ? "" : siteId, "roles", roles, "jti", java.util.UUID.randomUUID().toString())).issuedAt(now).expiration(new Date(now.getTime() + ttl.toMillis())).signWith(key()).compact();
  }
  public Claims parse(String token) { return Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload(); }
  private SecretKey key() {
    String secret = properties.jwtSecret();
    if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes");
    return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }
}
