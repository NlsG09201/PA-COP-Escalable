package com.COP_Escalable.Backend.publicbooking.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "public_bookings")
public class PublicBooking extends TenantScopedEntity {
	@Column(nullable = false)
	private String serviceId;

	@Column(nullable = false)
	private String serviceName;

	@Column(nullable = false)
	private String serviceCategory;

	@Column(nullable = false)
	private String patientName;

	@Column
	private String patientEmail;

	@Column
	private String patientPhone;

	@Column
	private String notes;

	@Column(nullable = false)
	private long quotedPrice;

	@Column(nullable = false)
	private Instant appointmentStartAt;

	@Column(nullable = false)
	private Instant appointmentEndAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Column
	private Instant expiresAt;

	@Column
	private UUID professionalId;

	@Column
	private UUID patientId;

	@Column
	private UUID appointmentId;

	@Column
	private UUID paymentId;

	protected PublicBooking() {}

	public static PublicBooking createPendingPayment(
			UUID organizationId,
			UUID siteId,
			String serviceId,
			String serviceName,
			String serviceCategory,
			String patientName,
			String patientEmail,
			String patientPhone,
			String notes,
			long quotedPrice,
			Instant appointmentStartAt,
			Instant appointmentEndAt,
			Instant expiresAt,
			UUID professionalId
	) {
		if (siteId == null) throw new IllegalArgumentException("siteId is required");
		if (serviceId == null || serviceId.isBlank()) throw new IllegalArgumentException("serviceId is required");
		if (patientName == null || patientName.isBlank()) throw new IllegalArgumentException("patientName is required");
		if (appointmentStartAt == null || appointmentEndAt == null) throw new IllegalArgumentException("appointment slot is required");
		if (!appointmentEndAt.isAfter(appointmentStartAt)) throw new IllegalArgumentException("appointmentEndAt must be after appointmentStartAt");

		var booking = new PublicBooking();
		booking.setTenant(organizationId, siteId);
		booking.serviceId = serviceId.trim();
		booking.serviceName = serviceName == null || serviceName.isBlank() ? serviceId.trim() : serviceName.trim();
		booking.serviceCategory = serviceCategory == null || serviceCategory.isBlank() ? "GENERAL" : serviceCategory.trim();
		booking.patientName = patientName.trim();
		booking.patientEmail = patientEmail == null || patientEmail.isBlank() ? null : patientEmail.trim().toLowerCase();
		booking.patientPhone = patientPhone == null || patientPhone.isBlank() ? null : patientPhone.trim();
		booking.notes = notes == null || notes.isBlank() ? null : notes.trim();
		booking.quotedPrice = quotedPrice;
		booking.appointmentStartAt = appointmentStartAt;
		booking.appointmentEndAt = appointmentEndAt;
		booking.status = Status.PENDING_PAYMENT;
		booking.expiresAt = expiresAt;
		booking.professionalId = professionalId;
		return booking;
	}

	public void attachPayment(UUID paymentId) {
		this.paymentId = paymentId;
	}

	public void confirm(UUID patientId, UUID appointmentId) {
		this.patientId = patientId;
		this.appointmentId = appointmentId;
		this.status = Status.CONFIRMED;
		this.expiresAt = null;
	}

	public void cancel() {
		this.status = Status.CANCELLED;
		this.expiresAt = null;
	}

	public void expire() {
		if (this.status == Status.CONFIRMED || this.status == Status.CANCELLED) {
			return;
		}
		this.status = Status.EXPIRED;
	}

	public String getServiceId() {
		return serviceId;
	}

	public String getServiceName() {
		return serviceName;
	}

	public String getServiceCategory() {
		return serviceCategory;
	}

	public String getPatientName() {
		return patientName;
	}

	public String getPatientEmail() {
		return patientEmail;
	}

	public String getPatientPhone() {
		return patientPhone;
	}

	public String getNotes() {
		return notes;
	}

	public long getQuotedPrice() {
		return quotedPrice;
	}

	public Instant getAppointmentStartAt() {
		return appointmentStartAt;
	}

	public Instant getAppointmentEndAt() {
		return appointmentEndAt;
	}

	public Status getStatus() {
		return status;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public UUID getProfessionalId() {
		return professionalId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public UUID getAppointmentId() {
		return appointmentId;
	}

	public UUID getPaymentId() {
		return paymentId;
	}

	public enum Status {
		DRAFT,
		PENDING_PAYMENT,
		CONFIRMED,
		CANCELLED,
		EXPIRED
	}
}
