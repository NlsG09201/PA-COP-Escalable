package com.COP_Escalable.patientsservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/patients")
public class LegacyPatientsProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyPatientsProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> list(HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/api/patients")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(response.getHeaders())
						.body(response.bodyTo(String.class)));
	}

	@GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> get(@PathVariable String id, HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/api/patients/" + id)
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(response.getHeaders())
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> create(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/api/patients")
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

