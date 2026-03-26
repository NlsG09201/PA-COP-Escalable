package com.COP_Escalable.Backend.appointments.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "appointments")
public class Appointment extends TenantScopedEntity {

	@Field("professional_id")
	private UUID professionalId;

	@Field("patient_id")
	private UUID patientId;

	@Field("start_at")
	private Instant startAt;

	@Field("end_at")
	private Instant endAt;

	private AppointmentStatus status;

	private String reason;

	@Field("service_offering_id")
	private UUID serviceOfferingId;

	@Field("service_name_snapshot")
	private String serviceNameSnapshot;

	@Field("service_category_snapshot")
	private String serviceCategorySnapshot;

	@Version
	private Long version;

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
