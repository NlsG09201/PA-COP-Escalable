package com.COP_Escalable.psychtestsservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/psych-tests")
public class LegacyPsychTestsProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyPsychTestsProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(value = "/templates", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> templates(HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/api/psych-tests/templates")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/templates", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> createTemplate(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/api/psych-tests/templates")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@GetMapping(value = "/patients/{patientId}/submissions", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> submissions(@PathVariable String patientId, HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/api/psych-tests/patients/" + patientId + "/submissions")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/patients/{patientId}/submissions", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> submit(@PathVariable String patientId, @RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/api/psych-tests/patients/" + patientId + "/submissions")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
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

	private static HttpHeaders copyResponseHeaders(HttpHeaders source) {
		var headers = new HttpHeaders();
		headers.putAll(source);
		headers.remove(HttpHeaders.TRANSFER_ENCODING);
		headers.remove(HttpHeaders.CONTENT_LENGTH);
		headers.remove(HttpHeaders.CONNECTION);
		headers.remove("Keep-Alive");
		headers.remove(HttpHeaders.PROXY_AUTHENTICATE);
		headers.remove(HttpHeaders.PROXY_AUTHORIZATION);
		headers.remove(HttpHeaders.TE);
		headers.remove(HttpHeaders.TRAILER);
		headers.remove(HttpHeaders.UPGRADE);
		return headers;
	}
}

