package com.COP_Escalable.Backend.appointments.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class Appointment extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID professionalId;

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false)
	private Instant startAt;

	@Column(nullable = false)
	private Instant endAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AppointmentStatus status;

	@Column
	private String reason;

	@Column(name = "service_offering_id")
	private UUID serviceOfferingId;

	@Column(name = "service_name_snapshot")
	private String serviceNameSnapshot;

	@Column(name = "service_category_snapshot")
	private String serviceCategorySnapshot;

	@Version
	@Column(nullable = false)
	private long version;

	protected Appointment() {}

	public static Appointment request(UUID organizationId, UUID siteId, UUID professionalId, UUID patientId, Instant startAt, Instant endAt, String reason) {
		return request(organizationId, siteId, professionalId, patientId, startAt, endAt, reason, null, null, null);
	}

	public static Appointment request(
			UUID organizationId,
			UUID siteId,
			UUID professionalId,
			UUID patientId,
			Instant startAt,
			Instant endAt,
			String reason,
			UUID serviceOfferingId,
			String serviceNameSnapshot,
			String serviceCategorySnapshot
	) {
		if (siteId == null) throw new IllegalArgumentException("siteId is required");
		if (professionalId == null) throw new IllegalArgumentException("professionalId is required");
		if (patientId == null) throw new IllegalArgumentException("patientId is required");
		if (startAt == null || endAt == null) throw new IllegalArgumentException("startAt/endAt is required");
		if (!endAt.isAfter(startAt)) throw new IllegalArgumentException("endAt must be after startAt");
		var a = new Appointment();
		a.setTenant(organizationId, siteId);
		a.professionalId = professionalId;
		a.patientId = patientId;
		a.startAt = startAt;
		a.endAt = endAt;
		a.status = AppointmentStatus.REQUESTED;
		a.reason = reason == null || reason.isBlank() ? null : reason.trim();
		a.serviceOfferingId = serviceOfferingId;
		a.serviceNameSnapshot = serviceNameSnapshot == null || serviceNameSnapshot.isBlank() ? null : serviceNameSnapshot.trim();
		a.serviceCategorySnapshot = serviceCategorySnapshot == null || serviceCategorySnapshot.isBlank() ? null : serviceCategorySnapshot.trim();
		return a;
	}

	public void confirm() {
		if (status == AppointmentStatus.CONFIRMED) {
			return;
		}
		if (status != AppointmentStatus.REQUESTED) {
			throw new IllegalArgumentException("Only requested appointments can be confirmed");
		}
		status = AppointmentStatus.CONFIRMED;
	}

	public void cancel() {
		if (status == AppointmentStatus.CANCELLED) {
			return;
		}
		if (status == AppointmentStatus.COMPLETED) {
			throw new IllegalArgumentException("Completed appointments cannot be cancelled");
		}
		status = AppointmentStatus.CANCELLED;
	}

	public UUID getProfessionalId() {
		return professionalId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public Instant getStartAt() {
		return startAt;
	}

	public Instant getEndAt() {
		return endAt;
	}

	public AppointmentStatus getStatus() {
		return status;
	}

	public String getReason() {
		return reason;
	}

	public UUID getServiceOfferingId() {
		return serviceOfferingId;
	}

	public String getServiceNameSnapshot() {
		return serviceNameSnapshot;
	}

	public String getServiceCategorySnapshot() {
		return serviceCategorySnapshot;
	}
}

