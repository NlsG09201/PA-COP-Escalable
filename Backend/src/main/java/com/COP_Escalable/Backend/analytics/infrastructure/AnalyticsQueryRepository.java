package com.COP_Escalable.Backend.analytics.infrastructure;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class AnalyticsQueryRepository {
	private final JdbcTemplate jdbc;

	public AnalyticsQueryRepository(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public SiteOverviewRow sumSiteOverview(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		var sql = """
				select
				  coalesce(sum(appointments_created), 0) as appointments_created,
				  coalesce(sum(appointments_confirmed), 0) as appointments_confirmed,
				  coalesce(sum(appointments_cancelled), 0) as appointments_cancelled,
				  coalesce(sum(appointments_completed), 0) as appointments_completed,
				  coalesce(sum(patients_new), 0) as patients_new,
				  coalesce(sum(revenue_paid_cents), 0) as revenue_paid_cents,
				  coalesce(sum(booked_minutes), 0) as booked_minutes
				from analytics_daily_site_metrics
				where organization_id = ? and site_id = ? and day between ? and ?
				""";
		return jdbc.queryForObject(
				sql,
				new SiteOverviewRowMapper(),
				organizationId,
				siteId,
				Date.valueOf(fromDay),
				Date.valueOf(toDay)
		);
	}

	public List<SpecialtyBreakdownRow> sumBySpecialty(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		var sql = """
				select
				  specialty,
				  coalesce(sum(appointments_created), 0) as appointments_created,
				  coalesce(sum(appointments_confirmed), 0) as appointments_confirmed,
				  coalesce(sum(appointments_cancelled), 0) as appointments_cancelled,
				  coalesce(sum(revenue_paid_cents), 0) as revenue_paid_cents,
				  coalesce(sum(booked_minutes), 0) as booked_minutes
				from analytics_daily_specialty_metrics
				where organization_id = ? and site_id = ? and day between ? and ?
				group by specialty
				order by appointments_created desc, specialty asc
				""";
		return jdbc.query(
				sql,
				(rs, rowNum) -> new SpecialtyBreakdownRow(
						rs.getString("specialty"),
						rs.getLong("appointments_created"),
						rs.getLong("appointments_confirmed"),
						rs.getLong("appointments_cancelled"),
						rs.getLong("revenue_paid_cents"),
						rs.getLong("booked_minutes")
				),
				organizationId,
				siteId,
				Date.valueOf(fromDay),
				Date.valueOf(toDay)
		);
	}

	public List<DoctorPerformanceRow> doctorPerformance(
			UUID organizationId,
			UUID siteId,
			LocalDate fromDay,
			LocalDate toDay,
			int limit
	) {
		var sql = """
				select
				  m.professional_id,
				  coalesce(p.full_name, '') as full_name,
				  coalesce(p.specialty, '') as specialty,
				  coalesce(sum(m.appointments_created), 0) as appointments_created,
				  coalesce(sum(m.appointments_confirmed), 0) as appointments_confirmed,
				  coalesce(sum(m.appointments_cancelled), 0) as appointments_cancelled,
				  coalesce(sum(m.revenue_paid_cents), 0) as revenue_paid_cents,
				  coalesce(sum(m.booked_minutes), 0) as booked_minutes
				from analytics_daily_professional_metrics m
				left join professionals p on p.id = m.professional_id and p.organization_id = m.organization_id
				where m.organization_id = ? and m.site_id = ? and m.day between ? and ?
				group by m.professional_id, p.full_name, p.specialty
				order by appointments_confirmed desc, revenue_paid_cents desc, appointments_created desc
				limit ?
				""";
		return jdbc.query(
				sql,
				(rs, rowNum) -> new DoctorPerformanceRow(
						(UUID) rs.getObject("professional_id"),
						rs.getString("full_name"),
						rs.getString("specialty"),
						rs.getLong("appointments_created"),
						rs.getLong("appointments_confirmed"),
						rs.getLong("appointments_cancelled"),
						rs.getLong("revenue_paid_cents"),
						rs.getLong("booked_minutes")
				),
				organizationId,
				siteId,
				Date.valueOf(fromDay),
				Date.valueOf(toDay),
				limit
		);
	}

	public List<SiteTimeseriesRow> siteTimeseries(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		var sql = """
				select
				  day,
				  appointments_created,
				  appointments_confirmed,
				  appointments_cancelled,
				  revenue_paid_cents
				from analytics_daily_site_metrics
				where organization_id = ? and site_id = ? and day between ? and ?
				order by day asc
				""";
		return jdbc.query(
				sql,
				(rs, rowNum) -> new SiteTimeseriesRow(
						rs.getDate("day").toLocalDate(),
						rs.getLong("appointments_created"),
						rs.getLong("appointments_confirmed"),
						rs.getLong("appointments_cancelled"),
						rs.getLong("revenue_paid_cents")
				),
				organizationId,
				siteId,
				Date.valueOf(fromDay),
				Date.valueOf(toDay)
		);
	}

	public record SiteOverviewRow(
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long appointmentsCompleted,
			long patientsNew,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record SpecialtyBreakdownRow(
			String specialty,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record DoctorPerformanceRow(
			UUID professionalId,
			String fullName,
			String specialty,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record SiteTimeseriesRow(
			LocalDate day,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents
	) {}

	private static final class SiteOverviewRowMapper implements RowMapper<SiteOverviewRow> {
		@Override
		public SiteOverviewRow mapRow(ResultSet rs, int rowNum) throws SQLException {
			return new SiteOverviewRow(
					rs.getLong("appointments_created"),
					rs.getLong("appointments_confirmed"),
					rs.getLong("appointments_cancelled"),
					rs.getLong("appointments_completed"),
					rs.getLong("patients_new"),
					rs.getLong("revenue_paid_cents"),
					rs.getLong("booked_minutes")
			);
		}
	}
}
