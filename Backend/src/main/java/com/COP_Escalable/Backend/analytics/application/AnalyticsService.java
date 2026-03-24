package com.COP_Escalable.Backend.analytics.application;

import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsQueryRepository;
import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsQueryRepository.DoctorPerformanceRow;
import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsQueryRepository.SiteOverviewRow;
import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsQueryRepository.SiteTimeseriesRow;
import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsQueryRepository.SpecialtyBreakdownRow;
import com.COP_Escalable.Backend.patients.domain.PatientStatus;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class AnalyticsService {
	private final AnalyticsQueryRepository queries;
	private final PatientRepository patients;
	private final SiteRepository sites;
	private final AnalyticsCacheService cache;
	private final AnalyticsProperties properties;

	public AnalyticsService(
			AnalyticsQueryRepository queries,
			PatientRepository patients,
			SiteRepository sites,
			AnalyticsCacheService cache,
			AnalyticsProperties properties
	) {
		this.queries = queries;
		this.patients = patients;
		this.sites = sites;
		this.cache = cache;
		this.properties = properties;
	}

	@Transactional(readOnly = true)
	public DashboardOverviewResponse overview(Instant from, Instant to) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		if (toDay.isBefore(fromDay)) {
			throw new IllegalArgumentException("to must be on or after from");
		}

		var key = cacheKey(ctx.organizationId(), ctx.siteId(), "overview", fromDay, toDay);
		return cache.get(key, DashboardOverviewResponse.class)
				.orElseGet(() -> {
					var row = queries.sumSiteOverview(ctx.organizationId(), ctx.siteId(), fromDay, toDay);
					var patientsTotal = patients.countByOrganizationIdAndSiteIdAndStatus(
							ctx.organizationId(),
							ctx.siteId(),
							PatientStatus.ACTIVE
					);
					var response = toOverviewResponse(from, to, zone.getId(), row, patientsTotal);
					cache.put(key, response, cacheTtl("kpis"));
					return response;
				});
	}

	@Transactional(readOnly = true)
	public TimeseriesResponse timeseries(Instant from, Instant to) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		if (toDay.isBefore(fromDay)) {
			throw new IllegalArgumentException("to must be on or after from");
		}
		var key = cacheKey(ctx.organizationId(), ctx.siteId(), "timeseries", fromDay, toDay);
		return cache.get(key, TimeseriesResponse.class)
				.orElseGet(() -> {
					var rows = queries.siteTimeseries(ctx.organizationId(), ctx.siteId(), fromDay, toDay);
					var response = new TimeseriesResponse(
							from,
							to,
							zone.getId(),
							rows.stream().map(this::mapTimeseriesPoint).toList()
					);
					cache.put(key, response, cacheTtl("trend"));
					return response;
				});
	}

	@Transactional(readOnly = true)
	public AppointmentsBySpecialtyResponse appointmentsBySpecialty(Instant from, Instant to) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		if (toDay.isBefore(fromDay)) {
			throw new IllegalArgumentException("to must be on or after from");
		}
		var key = cacheKey(ctx.organizationId(), ctx.siteId(), "specialty", fromDay, toDay);
		return cache.get(key, AppointmentsBySpecialtyResponse.class)
				.orElseGet(() -> {
					var rows = queries.sumBySpecialty(ctx.organizationId(), ctx.siteId(), fromDay, toDay);
					var response = new AppointmentsBySpecialtyResponse(
							from,
							to,
							zone.getId(),
							rows.stream().map(this::mapSpecialty).toList()
					);
					cache.put(key, response, cacheTtl("distribution"));
					return response;
				});
	}

	@Transactional(readOnly = true)
	public DoctorsPerformanceResponse doctorsPerformance(Instant from, Instant to, int limit) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		var safeLimit = Math.min(Math.max(limit, 1), 100);
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		if (toDay.isBefore(fromDay)) {
			throw new IllegalArgumentException("to must be on or after from");
		}
		var key = cacheKey(ctx.organizationId(), ctx.siteId(), "doctors:" + safeLimit, fromDay, toDay);
		return cache.get(key, DoctorsPerformanceResponse.class)
				.orElseGet(() -> {
					var rows = queries.doctorPerformance(ctx.organizationId(), ctx.siteId(), fromDay, toDay, safeLimit);
					var response = new DoctorsPerformanceResponse(
							from,
							to,
							zone.getId(),
							rows.stream().map(this::mapDoctor).toList()
					);
					cache.put(key, response, cacheTtl("doctors"));
					return response;
				});
	}

	@Transactional(readOnly = true)
	public RevenueResponse revenue(Instant from, Instant to) {
		var overview = overview(from, to);
		return new RevenueResponse(
				overview.range().from(),
				overview.range().to(),
				overview.range().timezone(),
				overview.overview().revenuePaidCents(),
				"COP"
		);
	}

	@Transactional(readOnly = true)
	public KpisResponse kpis(Instant from, Instant to) {
		var overview = overview(from, to);
		double totalAppointments = Math.max(0, overview.overview().appointmentsCreated());
		double totalDays = Math.max(1, ChronoUnit.DAYS.between(from, to) + 1);
		double cancellationRate = totalAppointments == 0 ? 0 : (overview.overview().appointmentsCancelled() * 100.0) / totalAppointments;
		return new KpisResponse(
				overview.range().from(),
				overview.range().to(),
				overview.range().timezone(),
				overview.overview().appointmentsCreated(),
				overview.patientsRegisteredTotal(),
				overview.overview().revenuePaidCents(),
				totalAppointments / totalDays,
				cancellationRate,
				"COP"
		);
	}

	@Transactional(readOnly = true)
	public TrendResponse appointmentsTrend(Instant from, Instant to, GroupBy groupBy) {
		return trend(from, to, groupBy, true);
	}

	@Transactional(readOnly = true)
	public TrendResponse revenueTrend(Instant from, Instant to, GroupBy groupBy) {
		return trend(from, to, groupBy, false);
	}

	@Transactional(readOnly = true)
	public HeatmapResponse appointmentsHeatmap(Instant from, Instant to) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		var key = cacheKey(ctx.organizationId(), ctx.siteId(), "heatmap", fromDay, toDay);
		return cache.get(key, HeatmapResponse.class).orElseGet(() -> {
			var rows = queries.appointmentHeatmap(ctx.organizationId(), ctx.siteId(), fromDay, toDay);
			var response = new HeatmapResponse(
					from, to, zone.getId(),
					rows.stream().map(r -> new HeatmapCell(r.dayOfWeek(), r.hourOfDay(), r.total())).toList()
			);
			cache.put(key, response, cacheTtl("heatmap"));
			return response;
		});
	}

	private TrendResponse trend(Instant from, Instant to, GroupBy groupBy, boolean appointments) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		var zone = resolveZone(ctx.organizationId(), ctx.siteId());
		var fromDay = toLocalDate(from, zone);
		var toDay = toLocalDate(to, zone);
		if (toDay.isBefore(fromDay)) {
			throw new IllegalArgumentException("to must be on or after from");
		}
		var effectiveGroupBy = normalizeGroupBy(groupBy, fromDay, toDay);
		var kind = appointments ? "appointments-trend:" + effectiveGroupBy.name().toLowerCase() : "revenue-trend:" + effectiveGroupBy.name().toLowerCase();
		var key = cacheKey(ctx.organizationId(), ctx.siteId(), kind, fromDay, toDay);
		return cache.get(key, TrendResponse.class).orElseGet(() -> {
			var rows = appointments
					? queries.appointmentTrend(ctx.organizationId(), ctx.siteId(), fromDay, toDay, effectiveGroupBy.sqlBucket())
					: queries.revenueTrend(ctx.organizationId(), ctx.siteId(), fromDay, toDay, effectiveGroupBy.sqlBucket());
			var response = new TrendResponse(
					from, to, zone.getId(), effectiveGroupBy,
					rows.stream().map(r -> new TrendPoint(r.bucket(), r.total())).toList()
			);
			cache.put(key, response, cacheTtl("trend"));
			return response;
		});
	}

	private GroupBy normalizeGroupBy(GroupBy requested, LocalDate fromDay, LocalDate toDay) {
		long days = ChronoUnit.DAYS.between(fromDay, toDay) + 1;
		if (requested == GroupBy.DAY && days > 120) {
			return GroupBy.WEEK;
		}
		if (requested == GroupBy.WEEK && days > 730) {
			return GroupBy.MONTH;
		}
		return requested;
	}

	private DashboardOverviewResponse toOverviewResponse(
			Instant from,
			Instant to,
			String timezoneId,
			SiteOverviewRow row,
			long patientsRegisteredTotal
	) {
		return new DashboardOverviewResponse(
				new DateRange(from, to, timezoneId),
				new OverviewMetrics(
						row.appointmentsCreated(),
						row.appointmentsConfirmed(),
						row.appointmentsCancelled(),
						row.appointmentsCompleted(),
						row.patientsNew(),
						row.revenuePaidCents(),
						row.bookedMinutes()
				),
				patientsRegisteredTotal
		);
	}

	private TimeseriesPoint mapTimeseriesPoint(SiteTimeseriesRow r) {
		return new TimeseriesPoint(
				r.day(),
				r.appointmentsCreated(),
				r.appointmentsConfirmed(),
				r.appointmentsCancelled(),
				r.revenuePaidCents()
		);
	}

	private SpecialtySlice mapSpecialty(SpecialtyBreakdownRow r) {
		return new SpecialtySlice(
				r.specialty(),
				r.appointmentsCreated(),
				r.appointmentsConfirmed(),
				r.appointmentsCancelled(),
				r.revenuePaidCents(),
				r.bookedMinutes()
		);
	}

	private DoctorPerformanceSlice mapDoctor(DoctorPerformanceRow r) {
		return new DoctorPerformanceSlice(
				r.professionalId(),
				r.fullName(),
				r.specialty(),
				r.appointmentsCreated(),
				r.appointmentsConfirmed(),
				r.appointmentsCancelled(),
				r.revenuePaidCents(),
				r.bookedMinutes()
		);
	}

	private ZoneId resolveZone(UUID organizationId, UUID siteId) {
		var site = sites.findByIdAndOrganizationId(siteId, organizationId).orElse(null);
		if (site == null) {
			return ZoneId.of("UTC");
		}
		try {
			return ZoneId.of(site.getTimezone());
		} catch (Exception ex) {
			return ZoneId.of("UTC");
		}
	}

	private static LocalDate toLocalDate(Instant instant, ZoneId zone) {
		return instant.atZone(zone).toLocalDate();
	}

	private static String cacheKey(UUID orgId, UUID siteId, String kind, LocalDate fromDay, LocalDate toDay) {
		return AnalyticsCacheService.overviewKey(orgId + ":" + siteId, kind + ":" + fromDay + ":" + toDay);
	}

	private int cacheTtl(String kind) {
		return switch (kind) {
			case "kpis" ->  properties.kpiTtlSeconds();
			case "trend" -> properties.trendTtlSeconds();
			case "distribution" -> properties.distributionTtlSeconds();
			case "doctors" -> properties.doctorsTtlSeconds();
			case "heatmap" -> properties.heatmapTtlSeconds();
			default -> properties.cacheTtlSeconds();
		};
	}

	public record DateRange(Instant from, Instant to, String timezone) {}

	public record OverviewMetrics(
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long appointmentsCompleted,
			long patientsNewInPeriod,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record DashboardOverviewResponse(
			DateRange range,
			OverviewMetrics overview,
			long patientsRegisteredTotal
	) {}

	public record TimeseriesPoint(
			LocalDate day,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents
	) {}

	public record TimeseriesResponse(
			Instant from,
			Instant to,
			String timezone,
			List<TimeseriesPoint> series
	) {}

	public record SpecialtySlice(
			String specialty,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record AppointmentsBySpecialtyResponse(
			Instant from,
			Instant to,
			String timezone,
			List<SpecialtySlice> specialties
	) {}

	public record DoctorPerformanceSlice(
			UUID professionalId,
			String fullName,
			String specialty,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents,
			long bookedMinutes
	) {}

	public record DoctorsPerformanceResponse(
			Instant from,
			Instant to,
			String timezone,
			List<DoctorPerformanceSlice> doctors
	) {}

	public record RevenueResponse(
			Instant from,
			Instant to,
			String timezone,
			long revenuePaidCents,
			String currency
	) {}

	public enum GroupBy {
		DAY("day"),
		WEEK("week"),
		MONTH("month"),
		YEAR("year");
		private final String sqlBucket;
		GroupBy(String sqlBucket) { this.sqlBucket = sqlBucket; }
		public String sqlBucket() { return sqlBucket; }
	}

	public record KpisResponse(
			Instant from,
			Instant to,
			String timezone,
			long totalAppointments,
			long totalPatientsActive,
			long totalRevenueCents,
			double avgAppointmentsPerDay,
			double cancellationRatePct,
			String currency
	) {}

	public record TrendPoint(LocalDate bucket, long total) {}
	public record TrendResponse(Instant from, Instant to, String timezone, GroupBy groupBy, List<TrendPoint> series) {}
	public record HeatmapCell(int dayOfWeek, int hourOfDay, long total) {}
	public record HeatmapResponse(Instant from, Instant to, String timezone, List<HeatmapCell> cells) {}

}
