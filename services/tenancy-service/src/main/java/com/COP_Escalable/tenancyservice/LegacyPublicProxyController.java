package com.COP_Escalable.tenancyservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/public")
public class LegacyPublicProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyPublicProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(value = "/sites", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> sites(HttpServletRequest httpReq) {
		return rest.get()
				.uri(legacyBaseUrl + "/public/sites")
				.headers(h -> h.addAll(forwardHeaders(httpReq)))
				.accept(MediaType.APPLICATION_JSON)
				.retrieve()
				.toEntity(String.class);
	}

	private static HttpHeaders forwardHeaders(HttpServletRequest incoming) {
		var headers = new HttpHeaders();
		String ua = incoming.getHeader("User-Agent");
		if (StringUtils.hasText(ua)) headers.set("User-Agent", ua);
		String xf = incoming.getHeader("X-Forwarded-For");
		if (StringUtils.hasText(xf)) headers.set("X-Forwarded-For", xf);
		return headers;
	}
}

