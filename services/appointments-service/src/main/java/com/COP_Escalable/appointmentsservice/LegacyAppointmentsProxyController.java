package com.COP_Escalable.appointmentsservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/appointments")
public class LegacyAppointmentsProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;

	public LegacyAppointmentsProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> list(HttpServletRequest req) {
		return rest.get()
				.uri(legacyAppointmentsUrl(req))
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> create(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/api/appointments")
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

	private URI legacyAppointmentsUrl(HttpServletRequest incoming) {
		var builder = UriComponentsBuilder.fromUriString(legacyBaseUrl + "/api/appointments");
		incoming.getParameterMap().forEach((name, values) -> {
			if (values == null || values.length == 0) {
				builder.queryParam(name);
				return;
			}
			for (String value : values) {
				builder.queryParam(name, value);
			}
		});
		return builder.build().toUri();
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

