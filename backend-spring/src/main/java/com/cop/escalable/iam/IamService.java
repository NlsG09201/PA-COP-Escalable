package com.cop.escalable.iam;

import com.cop.escalable.iam.dto.TokenResponse;
import com.cop.escalable.security.JwtService;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class IamService {
  private final MongoTemplate mongo; private final PasswordEncoder passwords; private final JwtService jwt;
  public IamService(MongoTemplate mongo, PasswordEncoder passwords, JwtService jwt) { this.mongo = mongo; this.passwords = passwords; this.jwt = jwt; }
  public TokenResponse login(String username, String password, String siteId, String ip, String userAgent) {
    String login = username.trim().toLowerCase();
    Document user = mongo.getCollection("users").find(new Document("$or", List.of(new Document("username", login), new Document("email", login)))).first();
    if (user == null || !matches(password, user.getString("password_hash"))) throw new BadCredentialsException("Invalid credentials");
    return issue(user, siteId, ip, userAgent);
  }
  public TokenResponse refresh(String rawToken, String ip, String userAgent) {
    String hash = sha256(rawToken.trim());
    Document stored = mongo.getCollection("refresh_tokens").find(new Document("token_hash", hash)).first();
    if (stored == null || stored.getDate("expires_at") == null || stored.getDate("expires_at").before(java.util.Date.from(Instant.now()))) throw new BadCredentialsException("Invalid or expired refresh token");
    Object userId = stored.get("user_id");
    Document user = mongo.getCollection("users").find(new Document("_id", userId)).first();
    if (user == null) throw new BadCredentialsException("User not found");
    mongo.getCollection("refresh_tokens").deleteOne(new Document("token_hash", hash));
    return issue(user, stored.getString("site_id"), ip, userAgent);
  }
  private TokenResponse issue(Document user, String siteId, String ip, String userAgent) {
    String id = String.valueOf(user.get("_id")); String username = user.getString("username"); String organization = String.valueOf(user.get("organization_id"));
    List<String> roles = user.getList("roles", String.class, List.of());
    String access = jwt.issue(username, id, organization, siteId, roles);
    byte[] bytes = new byte[40]; new SecureRandom().nextBytes(bytes); String refresh = HexFormat.of().formatHex(bytes);
    mongo.getCollection("refresh_tokens").insertOne(new Document("user_id", user.get("_id")).append("organization_id", user.get("organization_id")).append("site_id", siteId).append("token_hash", sha256(refresh)).append("issued_at", java.util.Date.from(Instant.now())).append("expires_at", java.util.Date.from(Instant.now().plus(7, ChronoUnit.DAYS))).append("ip_address", ip).append("user_agent", userAgent));
    return new TokenResponse(access, refresh, new TokenResponse.User(id, username, roles));
  }
  private boolean matches(String password, String hash) { return hash != null && passwords.matches(password, hash.startsWith("{bcrypt}") ? hash.substring(8) : hash); }
  private String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); } catch (Exception ex) { throw new IllegalStateException(ex); } }
}
