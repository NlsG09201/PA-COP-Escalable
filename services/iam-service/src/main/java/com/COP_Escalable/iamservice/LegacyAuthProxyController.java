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

	@PostMapping(value = "/refresh", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> refresh(@Valid @RequestBody RefreshRequest req, HttpServletRequest httpReq) {
		return forwardJson("/api/auth/refresh", Map.of("refreshToken", req.refreshToken()), httpReq);
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
				.retrieve()
				.toEntity(String.class);
	}

	public record LoginRequest(
			@NotBlank String username,
			@NotBlank String password,
			@NotNull UUID siteId
	) {}

	public record RefreshRequest(@NotBlank String refreshToken) {}
}

