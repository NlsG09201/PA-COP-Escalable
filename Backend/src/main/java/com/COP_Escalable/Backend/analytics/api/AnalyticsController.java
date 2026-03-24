package com.COP_Escalable.Backend.analytics.api;

import com.COP_Escalable.Backend.analytics.application.AnalyticsService;
import com.COP_Escalable.Backend.analytics.application.AnalyticsService.AppointmentsBySpecialtyResponse;
import com.COP_Escalable.Backend.analytics.application.AnalyticsService.DashboardOverviewResponse;
import com.COP_Escalable.Backend.analytics.application.AnalyticsService.DoctorsPerformanceResponse;
import com.COP_Escalable.Backend.analytics.application.AnalyticsService.RevenueResponse;
import com.COP_Escalable.Backend.analytics.application.AnalyticsService.TimeseriesResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/analytics/dashboard")
public class AnalyticsController {
	private final AnalyticsService analytics;

	public AnalyticsController(AnalyticsService analytics) {
		this.analytics = analytics;
	}

	@GetMapping("/overview")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public DashboardOverviewResponse overview(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
	) {
		return analytics.overview(from, to);
	}

	@GetMapping("/timeseries")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public TimeseriesResponse timeseries(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
	) {
		return analytics.timeseries(from, to);
	}

	@GetMapping("/appointments-by-specialty")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public AppointmentsBySpecialtyResponse appointmentsBySpecialty(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
	) {
		return analytics.appointmentsBySpecialty(from, to);
	}

	@GetMapping("/doctors-performance")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public DoctorsPerformanceResponse doctorsPerformance(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit
	) {
		return analytics.doctorsPerformance(from, to, limit);
	}

	@GetMapping("/revenue")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public RevenueResponse revenue(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
	) {
		return analytics.revenue(from, to);
	}
}
