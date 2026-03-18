package com.COP_Escalable.tenancyservice;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.Objects;

@RestController
@RequestMapping("/public")
public class LegacyPublicProxyController {
	private final RestClient rest;
	private final String legacyBaseUrl;
	private static final int MAX_ATTEMPTS = 5;
	private static final Duration RETRY_DELAY = Duration.ofMillis(400);

	public LegacyPublicProxyController(RestClient.Builder rest, @Value("${app.legacy.base-url}") String legacyBaseUrl) {
		this.rest = rest.build();
		this.legacyBaseUrl = legacyBaseUrl;
	}

	@GetMapping(value = "/sites", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> sites(HttpServletRequest httpReq) {
		ResourceAccessException lastError = null;
		for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			try {
				return rest.get()
						.uri(legacyUrl(httpReq, "/public/sites"))
						.headers(h -> h.addAll(forwardHeaders(httpReq)))
						.accept(MediaType.APPLICATION_JSON)
						.retrieve()
						.toEntity(String.class);
			} catch (ResourceAccessException ex) {
				lastError = ex;
				if (attempt == MAX_ATTEMPTS) {
					break;
				}
				try {
					Thread.sleep(RETRY_DELAY.toMillis());
				} catch (InterruptedException ie) {
					Thread.currentThread().interrupt();
					throw ex;
				}
			}
		}
		throw lastError == null ? new ResourceAccessException("Unable to reach legacy sites endpoint") : lastError;
	}

	@GetMapping(value = "/catalog", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> catalog(HttpServletRequest req) {
		return rest.get()
				.uri(legacyUrl(req, "/public/catalog"))
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@GetMapping(value = "/availability", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> availability(HttpServletRequest req) {
		return rest.get()
				.uri(legacyUrl(req, "/public/availability"))
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/bookings/quote", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> quoteBooking(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/public/bookings/quote")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/bookings", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> createBooking(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/public/bookings")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@GetMapping(value = "/bookings/{bookingId}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> booking(@PathVariable String bookingId, HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/public/bookings/" + bookingId)
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@GetMapping(value = "/bookings/{bookingId}/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> bookingNotifications(@PathVariable String bookingId, HttpServletRequest req) {
		return rest.get()
				.uri(legacyBaseUrl + "/public/bookings/" + bookingId + "/notifications")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.accept(MediaType.APPLICATION_JSON)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/bookings/{bookingId}/payments/intents", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> paymentIntent(
			@PathVariable String bookingId,
			@RequestBody(required = false) String body,
			HttpServletRequest req
	) {
		return rest.post()
				.uri(legacyBaseUrl + "/public/bookings/" + bookingId + "/payments/intents")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body == null ? "{}" : body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/bookings/{bookingId}/payments/complete", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> completePayment(@PathVariable String bookingId, @RequestBody(required = false) String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/public/bookings/" + bookingId + "/payments/complete")
				.headers(h -> h.addAll(forwardHeaders(req)))
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.APPLICATION_JSON)
				.body(body == null ? "{}" : body)
				.exchange((request, response) -> ResponseEntity
						.status(response.getStatusCode())
						.headers(copyResponseHeaders(response.getHeaders()))
						.body(response.bodyTo(String.class)));
	}

	@PostMapping(value = "/payments/webhook", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> webhook(@RequestBody String body, HttpServletRequest req) {
		return rest.post()
				.uri(legacyBaseUrl + "/public/payments/webhook")
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
		String ua = incoming.getHeader("User-Agent");
		if (StringUtils.hasText(ua)) headers.set("User-Agent", ua);
		String xf = incoming.getHeader("X-Forwarded-For");
		if (StringUtils.hasText(xf)) headers.set("X-Forwarded-For", xf);
		return headers;
	}

	private String legacyUrl(HttpServletRequest incoming, String path) {
		var builder = UriComponentsBuilder.fromUriString(legacyBaseUrl + path);
		incoming.getParameterMap().forEach((name, values) -> {
			if (values == null || values.length == 0) {
				builder.queryParam(name);
				return;
			}
			for (String value : values) {
				builder.queryParam(name, value);
			}
		});
		return Objects.requireNonNull(builder.build().toUriString());
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

