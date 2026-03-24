package com.COP_Escalable.Backend.analytics.infrastructure;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.UUID;

@Repository
public class AnalyticsRollupRepository {
	private static final String MERGE_SITE = """
			insert into analytics_daily_site_metrics (
			  organization_id, site_id, day,
			  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
			  patients_new, revenue_paid_cents, booked_minutes
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			on conflict (organization_id, site_id, day) do update set
			  appointments_created = analytics_daily_site_metrics.appointments_created + excluded.appointments_created,
			  appointments_confirmed = analytics_daily_site_metrics.appointments_confirmed + excluded.appointments_confirmed,
			  appointments_cancelled = analytics_daily_site_metrics.appointments_cancelled + excluded.appointments_cancelled,
			  appointments_completed = analytics_daily_site_metrics.appointments_completed + excluded.appointments_completed,
			  patients_new = analytics_daily_site_metrics.patients_new + excluded.patients_new,
			  revenue_paid_cents = analytics_daily_site_metrics.revenue_paid_cents + excluded.revenue_paid_cents,
			  booked_minutes = analytics_daily_site_metrics.booked_minutes + excluded.booked_minutes
			""";

	private static final String MERGE_SPECIALTY = """
			insert into analytics_daily_specialty_metrics (
			  organization_id, site_id, day, specialty,
			  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
			  revenue_paid_cents, booked_minutes
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			on conflict (organization_id, site_id, day, specialty) do update set
			  appointments_created = analytics_daily_specialty_metrics.appointments_created + excluded.appointments_created,
			  appointments_confirmed = analytics_daily_specialty_metrics.appointments_confirmed + excluded.appointments_confirmed,
			  appointments_cancelled = analytics_daily_specialty_metrics.appointments_cancelled + excluded.appointments_cancelled,
			  appointments_completed = analytics_daily_specialty_metrics.appointments_completed + excluded.appointments_completed,
			  revenue_paid_cents = analytics_daily_specialty_metrics.revenue_paid_cents + excluded.revenue_paid_cents,
			  booked_minutes = analytics_daily_specialty_metrics.booked_minutes + excluded.booked_minutes
			""";

	private static final String MERGE_PROFESSIONAL = """
			insert into analytics_daily_professional_metrics (
			  organization_id, site_id, day, professional_id,
			  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
			  revenue_paid_cents, booked_minutes
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			on conflict (organization_id, site_id, day, professional_id) do update set
			  appointments_created = analytics_daily_professional_metrics.appointments_created + excluded.appointments_created,
			  appointments_confirmed = analytics_daily_professional_metrics.appointments_confirmed + excluded.appointments_confirmed,
			  appointments_cancelled = analytics_daily_professional_metrics.appointments_cancelled + excluded.appointments_cancelled,
			  appointments_completed = analytics_daily_professional_metrics.appointments_completed + excluded.appointments_completed,
			  revenue_paid_cents = analytics_daily_professional_metrics.revenue_paid_cents + excluded.revenue_paid_cents,
			  booked_minutes = analytics_daily_professional_metrics.booked_minutes + excluded.booked_minutes
			""";

	private final JdbcTemplate jdbc;

	public AnalyticsRollupRepository(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public void mergeSite(
			UUID organizationId,
			UUID siteId,
			LocalDate day,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long appointmentsCompleted,
			long patientsNew,
			long revenuePaidCents,
			long bookedMinutes
	) {
		jdbc.update(
				MERGE_SITE,
				organizationId,
				siteId,
				Date.valueOf(day),
				appointmentsCreated,
				appointmentsConfirmed,
				appointmentsCancelled,
				appointmentsCompleted,
				patientsNew,
				revenuePaidCents,
				bookedMinutes
		);
	}

	public void mergeSpecialty(
			UUID organizationId,
			UUID siteId,
			LocalDate day,
			String specialty,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long appointmentsCompleted,
			long revenuePaidCents,
			long bookedMinutes
	) {
		jdbc.update(
				MERGE_SPECIALTY,
				organizationId,
				siteId,
				Date.valueOf(day),
				specialty,
				appointmentsCreated,
				appointmentsConfirmed,
				appointmentsCancelled,
				appointmentsCompleted,
				revenuePaidCents,
				bookedMinutes
		);
	}

	public void mergeProfessional(
			UUID organizationId,
			UUID siteId,
			LocalDate day,
			UUID professionalId,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long appointmentsCompleted,
			long revenuePaidCents,
			long bookedMinutes
	) {
		jdbc.update(
				MERGE_PROFESSIONAL,
				organizationId,
				siteId,
				Date.valueOf(day),
				professionalId,
				appointmentsCreated,
				appointmentsConfirmed,
				appointmentsCancelled,
				appointmentsCompleted,
				revenuePaidCents,
				bookedMinutes
		);
	}
}
