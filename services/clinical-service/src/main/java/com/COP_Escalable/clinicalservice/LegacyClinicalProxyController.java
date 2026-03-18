package com.COP_Escalable.clinicalservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/clinical")
public class LegacyClinicalProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyClinicalProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(value = "/records/{patientId}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> record(@PathVariable String patientId, HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/api/clinical/records/" + patientId)
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(response.getHeaders())
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/records/{patientId}/entries", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> addEntry(@PathVariable String patientId, @RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/api/clinical/records/" + patientId + "/entries")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(response.getHeaders())
						.body(response.bodyTo(String.class)));
	}

	private static HttpHeaders forwardHeaders(HttpServletRequest incoming) {
		var headers = new HttpHeaders();
		String auth = incoming.getHeader("Authorization");
		if (StringUtils.hasText(auth)) headers.set("Authorization", auth);
		String ua = incoming.getHeader("User-Agent");
		if (StringUtils.hasText(ua)) headers.set("User-Agent", ua);
		String xf = incoming.getHeader("X-Forwarded-For");
		if (StringUtils.hasText(xf)) headers.set("X-Forwarded-For", xf);
		return headers;
	}
}

