package com.COP_Escalable.Backend.analytics.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDate;
import java.util.UUID;

@Document(collection = "analytics_daily_specialty_metrics")
public class AnalyticsDailySpecialtyMetric {

	@Id
	private String id;

	@Field("organization_id")
	private UUID organizationId;

	@Field("site_id")
	private UUID siteId;

	private LocalDate day;

	private String specialty;

	@Field("appointments_created")
	private long appointmentsCreated;

	@Field("appointments_confirmed")
	private long appointmentsConfirmed;

	@Field("appointments_cancelled")
	private long appointmentsCancelled;

	@Field("appointments_completed")
	private long appointmentsCompleted;

	@Field("revenue_paid_cents")
	private long revenuePaidCents;

	@Field("booked_minutes")
	private long bookedMinutes;

	public String getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}

	public LocalDate getDay() {
		return day;
	}

	public String getSpecialty() {
		return specialty;
	}

	public long getAppointmentsCreated() {
		return appointmentsCreated;
	}

	public long getAppointmentsConfirmed() {
		return appointmentsConfirmed;
	}

	public long getAppointmentsCancelled() {
		return appointmentsCancelled;
	}

	public long getAppointmentsCompleted() {
		return appointmentsCompleted;
	}

	public long getRevenuePaidCents() {
		return revenuePaidCents;
	}

	public long getBookedMinutes() {
		return bookedMinutes;
	}
}
