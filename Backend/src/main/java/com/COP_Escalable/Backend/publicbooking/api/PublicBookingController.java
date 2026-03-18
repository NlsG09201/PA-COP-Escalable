package com.COP_Escalable.Backend.publicbooking.api;

import com.COP_Escalable.Backend.publicbooking.application.PublicBookingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/public")
public class PublicBookingController {
	private final PublicBookingService service;

	public PublicBookingController(PublicBookingService service) {
		this.service = service;
	}

	@GetMapping("/catalog")
	public List<PublicBookingService.ServiceSummary> catalog(@RequestParam(required = false) UUID siteId) {
		return service.listCatalog(siteId);
	}

	@GetMapping("/availability")
	public PublicBookingService.AvailabilitySummary availability(
			@RequestParam UUID siteId,
			@RequestParam String serviceId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate
	) {
		return service.getAvailability(siteId, serviceId, fromDate);
	}

	@PostMapping("/bookings/quote")
	public PublicBookingService.QuoteSummary quote(@Valid @RequestBody QuotePublicBookingRequest request) {
		return service.quoteBooking(new PublicBookingService.QuoteBookingCommand(
				request.siteId(),
				request.serviceId(),
				request.slotStartAt()
		));
	}

	@PostMapping("/bookings")
	public PublicBookingService.BookingSummary createBooking(@Valid @RequestBody CreatePublicBookingRequest request) {
		return service.createBooking(new PublicBookingService.CreateBookingCommand(
				request.siteId(),
				request.serviceId(),
				request.slotStartAt(),
				request.patientName(),
				request.email(),
				request.phone(),
				request.notes(),
				request.idempotencyKey()
		));
	}

	@GetMapping("/bookings/{bookingId}")
	public PublicBookingService.BookingSummary booking(@PathVariable UUID bookingId) {
		return service.getBooking(bookingId);
	}

	@GetMapping("/bookings/{bookingId}/notifications")
	public List<PublicBookingService.NotificationSummary> bookingNotifications(@PathVariable UUID bookingId) {
		return service.listBookingNotifications(bookingId);
	}

	@PostMapping("/bookings/{bookingId}/payments/intents")
	public PublicBookingService.PaymentSummary paymentIntent(
			@PathVariable UUID bookingId,
			@RequestBody(required = false) PaymentIntentRequest request
	) {
		return service.createPaymentIntent(
				bookingId,
				request == null ? null : request.providerKey(),
				request == null || request.idempotencyKey() == null || request.idempotencyKey().isBlank()
						? UUID.randomUUID().toString()
						: request.idempotencyKey()
		);
	}

	@PostMapping("/bookings/{bookingId}/payments/complete")
	public PublicBookingService.BookingSummary completePayment(
			@PathVariable UUID bookingId,
			@RequestBody(required = false) CompletePaymentRequest request
	) {
		return service.completePayment(bookingId, request == null ? "PAID" : request.status());
	}

	@PostMapping("/payments/webhook")
	public PublicBookingService.BookingSummary webhook(@Valid @RequestBody PaymentWebhookRequest request) {
		return service.handleWebhook(new PublicBookingService.PaymentWebhookCommand(
				request.bookingId(),
				request.providerKey(),
				request.providerReference(),
				request.status(),
				request.eventId(),
				request.idempotencyKey()
		));
	}

	public record CreatePublicBookingRequest(
			@NotNull UUID siteId,
			@NotBlank String serviceId,
			@NotNull Instant slotStartAt,
			@NotBlank String patientName,
			@NotBlank String email,
			@NotBlank String phone,
			String notes,
			String idempotencyKey
	) {}

	public record QuotePublicBookingRequest(
			@NotNull UUID siteId,
			@NotBlank String serviceId,
			@NotNull Instant slotStartAt
	) {}

	public record CompletePaymentRequest(String status) {}

	public record PaymentIntentRequest(String providerKey, String idempotencyKey) {}

	public record PaymentWebhookRequest(
			UUID bookingId,
			String providerKey,
			String providerReference,
			@NotBlank String status,
			String eventId,
			String idempotencyKey
	) {}
}
