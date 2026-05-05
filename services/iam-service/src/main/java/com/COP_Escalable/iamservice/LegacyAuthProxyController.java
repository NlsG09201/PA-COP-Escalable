package com.COP_Escalable.iamservice;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/auth")
public class LegacyAuthProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyAuthProxyController(
			RestClient.Builder rest,
			@Value("${app.legacy.base-url}") String legacyBaseUrl
	) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpReq) {
		return forwardJson("/api/auth/login", Map.of(
				"username", req.username(),
				"password", req.password(),
				"siteId", req.siteId().toString()
		), httpReq);
	}

	@PostMapping(value = "/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> refresh(@RequestBody(required = false) byte[] rawBody, HttpServletRequest httpReq) {
		String body = rawBody == null ? "" : new String(rawBody, StandardCharsets.UTF_8);
		String refreshToken = extractRefreshToken(body);
		if (!StringUtils.hasText(refreshToken)) {
			return ResponseEntity.badRequest().body("Missing refreshToken");
		}
		return forwardJson("/api/auth/refresh", Map.of("refreshToken", refreshToken), httpReq);
	}

	private String extractRefreshToken(String body) {
		if (!StringUtils.hasText(body)) {
			return null;
		}

		// Normalize body: sometimes it arrives as a raw string, sometimes as JSON,
		// and sometimes double-escaped from the gateway/frontend.
		String normalized = body.trim();
		
		// If it's a JSON object {"refreshToken":"..."}
		if (normalized.contains("\"refreshToken\"")) {
			// Normalize backslashes before quotes
			String cleanJson = normalized.replace("\\\"", "\"");
			java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
					"\"refreshToken\"\\s*:\\s*\"([^\"]*)\""
			);
			java.util.regex.Matcher matcher = pattern.matcher(cleanJson);
			if (matcher.find()) {
				return matcher.group(1);
			}
		}
		
		// If it's just a raw token or a quoted token "token"
		return normalized.replaceAll("^\"|\"$", "");
	}

	private ResponseEntity<String> forwardJson(String path, Object body, HttpServletRequest incoming) {
		var headers = new HttpHeaders();
		String ua = incoming.getHeader("User-Agent");
		if (StringUtils.hasText(ua)) headers.set("User-Agent", ua);
		String xf = incoming.getHeader("X-Forwarded-For");
		if (StringUtils.hasText(xf)) headers.set("X-Forwarded-For", xf);

		return rest.post()
				.uri(legacyBaseUrl + path)
				.headers(h -> h.addAll(headers))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(response.getHeaders())
						.body(response.bodyTo(String.class)));
	}

	public record LoginRequest(
			@NotBlank String username,
			@NotBlank String password,
			@NotNull UUID siteId
	) {}

	public record RefreshRequest(@NotBlank String refreshToken) {}
}

