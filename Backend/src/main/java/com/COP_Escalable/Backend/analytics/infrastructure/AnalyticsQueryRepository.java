package com.COP_Escalable.Backend.analytics.infrastructure;

import com.COP_Escalable.Backend.analytics.domain.AnalyticsDailySiteMetric;
import com.COP_Escalable.Backend.analytics.domain.AnalyticsDailySpecialtyMetric;
import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.group;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;

@Repository
public class AnalyticsQueryRepository {

	private final MongoTemplate mongo;
	private final ProfessionalRepository professionals;

	public AnalyticsQueryRepository(MongoTemplate mongo, ProfessionalRepository professionals) {
		this.mongo = mongo;
		this.professionals = professionals;
	}

	public SiteOverviewRow sumSiteOverview(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		Aggregation agg = newAggregation(
				match(Criteria.where("organization_id").is(organizationId)
						.and("site_id").is(siteId)
						.and("day").gte(fromDay).lte(toDay)),
				group()
						.sum("appointments_created").as("appointmentsCreated")
						.sum("appointments_confirmed").as("appointmentsConfirmed")
						.sum("appointments_cancelled").as("appointmentsCancelled")
						.sum("appointments_completed").as("appointmentsCompleted")
						.sum("patients_new").as("patientsNew")
						.sum("revenue_paid_cents").as("revenuePaidCents")
						.sum("booked_minutes").as("bookedMinutes")
		);
		AggregationResults<Document> results = mongo.aggregate(agg, "analytics_daily_site_metrics", Document.class);
		Document doc = results.getUniqueMappedResult();
		if (doc == null) {
			return new SiteOverviewRow(0, 0, 0, 0, 0, 0, 0);
		}
		return new SiteOverviewRow(
				longVal(doc, "appointmentsCreated"),
				longVal(doc, "appointmentsConfirmed"),
				longVal(doc, "appointmentsCancelled"),
				longVal(doc, "appointmentsCompleted"),
				longVal(doc, "patientsNew"),
				longVal(doc, "revenuePaidCents"),
				longVal(doc, "bookedMinutes")
		);
	}

	public List<SpecialtyBreakdownRow> sumBySpecialty(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		Aggregation agg = newAggregation(
				match(Criteria.where("organization_id").is(organizationId)
						.and("site_id").is(siteId)
						.and("day").gte(fromDay).lte(toDay)),
				group("specialty")
						.sum("appointments_created").as("appointmentsCreated")
						.sum("appointments_confirmed").as("appointmentsConfirmed")
						.sum("appointments_cancelled").as("appointmentsCancelled")
						.sum("revenue_paid_cents").as("revenuePaidCents")
						.sum("booked_minutes").as("bookedMinutes")
		);
		AggregationResults<Document> results = mongo.aggregate(agg, "analytics_daily_specialty_metrics", Document.class);
		List<SpecialtyBreakdownRow> rows = new ArrayList<>();
		for (Document doc : results.getMappedResults()) {
			String specialty = doc.getString("_id");
			if (specialty == null || specialty.isBlank()) {
				specialty = "_DESCONOCIDO_";
			}
			rows.add(new SpecialtyBreakdownRow(
					specialty,
					longVal(doc, "appointmentsCreated"),
					longVal(doc, "appointmentsConfirmed"),
					longVal(doc, "appointmentsCancelled"),
					longVal(doc, "revenuePaidCents"),
					longVal(doc, "bookedMinutes")
			));
		}
		rows.sort(Comparator.comparingLong(SpecialtyBreakdownRow::appointmentsCreated).reversed()
				.thenComparing(SpecialtyBreakdownRow::specialty));
		return rows;
	}

	public List<DoctorPerformanceRow> doctorPerformance(
			UUID organizationId,
			UUID siteId,
			LocalDate fromDay,
			LocalDate toDay,
			int limit
	) {
		Aggregation agg = newAggregation(
				match(Criteria.where("organization_id").is(organizationId)
						.and("site_id").is(siteId)
						.and("day").gte(fromDay).lte(toDay)),
				group("professional_id")
						.sum("appointments_created").as("appointmentsCreated")
						.sum("appointments_confirmed").as("appointmentsConfirmed")
						.sum("appointments_cancelled").as("appointmentsCancelled")
						.sum("revenue_paid_cents").as("revenuePaidCents")
						.sum("booked_minutes").as("bookedMinutes")
		);
		AggregationResults<Document> results = mongo.aggregate(agg, "analytics_daily_professional_metrics", Document.class);
		List<DoctorAgg> aggs = new ArrayList<>();
		for (Document doc : results.getMappedResults()) {
			UUID professionalId = toUuid(doc.get("_id"));
			if (professionalId == null) {
				continue;
			}
			aggs.add(new DoctorAgg(
					professionalId,
					longVal(doc, "appointmentsCreated"),
					longVal(doc, "appointmentsConfirmed"),
					longVal(doc, "appointmentsCancelled"),
					longVal(doc, "revenuePaidCents"),
					longVal(doc, "bookedMinutes")
			));
		}
		aggs.sort(Comparator
				.comparingLong(DoctorAgg::appointmentsConfirmed).reversed()
				.thenComparingLong(DoctorAgg::revenuePaidCents).reversed()
				.thenComparingLong(DoctorAgg::appointmentsCreated).reversed());
		List<DoctorPerformanceRow> rows = new ArrayList<>();
		for (int i = 0; i < Math.min(limit, aggs.size()); i++) {
			DoctorAgg a = aggs.get(i);
			var pro = professionals.findByIdAndOrganizationId(a.professionalId(), organizationId).orElse(null);
			String fullName = pro == null ? "" : (pro.getFullName() == null ? "" : pro.getFullName());
			String specialty = pro == null || pro.getSpecialty() == null ? "" : pro.getSpecialty();
			rows.add(new DoctorPerformanceRow(
					a.professionalId(),
					fullName,
					specialty,
					a.appointmentsCreated(),
					a.appointmentsConfirmed(),
					a.appointmentsCancelled(),
					a.revenuePaidCents(),
					a.bookedMinutes()
			));
		}
		return rows;
	}

	public List<SiteTimeseriesRow> siteTimeseries(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		Query q = Query.query(Criteria.where("organization_id").is(organizationId)
				.and("site_id").is(siteId)
				.and("day").gte(fromDay).lte(toDay));
		q.with(Sort.by(Sort.Direction.ASC, "day"));
		List<AnalyticsDailySiteMetric> docs = mongo.find(q, AnalyticsDailySiteMetric.class);
		Map<LocalDate, AnalyticsDailySiteMetric> byDay = new HashMap<>();
		for (AnalyticsDailySiteMetric d : docs) {
			byDay.put(d.getDay(), d);
		}
		List<SiteTimeseriesRow> rows = new ArrayList<>();
		for (LocalDate d = fromDay; !d.isAfter(toDay); d = d.plusDays(1)) {
			AnalyticsDailySiteMetric m = byDay.get(d);
			if (m == null) {
				rows.add(new SiteTimeseriesRow(d, 0, 0, 0, 0));
			} else {
				rows.add(new SiteTimeseriesRow(
						d,
						m.getAppointmentsCreated(),
						m.getAppointmentsConfirmed(),
						m.getAppointmentsCancelled(),
						m.getRevenuePaidCents()
				));
			}
		}
		return rows;
	}

	public List<TrendBucketRow> appointmentTrend(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay, String groupBy) {
		return trend(organizationId, siteId, fromDay, toDay, groupBy, true);
	}

	public List<TrendBucketRow> revenueTrend(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay, String groupBy) {
		return trend(organizationId, siteId, fromDay, toDay, groupBy, false);
	}

	private List<TrendBucketRow> trend(
			UUID organizationId,
			UUID siteId,
			LocalDate fromDay,
			LocalDate toDay,
			String groupBy,
			boolean appointments
	) {
		Query q = Query.query(Criteria.where("organization_id").is(organizationId)
				.and("site_id").is(siteId)
				.and("day").gte(fromDay).lte(toDay));
		List<AnalyticsDailySiteMetric> docs = mongo.find(q, AnalyticsDailySiteMetric.class);
		Map<LocalDate, long[]> sums = new HashMap<>();
		for (AnalyticsDailySiteMetric d : docs) {
			LocalDate bucket = bucketFor(d.getDay(), groupBy);
			sums.merge(bucket, new long[]{
					d.getAppointmentsCreated(),
					d.getRevenuePaidCents()
			}, (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});
		}
		List<LocalDate> keys = new ArrayList<>(sums.keySet());
		keys.sort(LocalDate::compareTo);
		List<TrendBucketRow> rows = new ArrayList<>();
		for (LocalDate k : keys) {
			long[] v = sums.get(k);
			long total = appointments ? v[0] : v[1];
			rows.add(new TrendBucketRow(k, total));
		}
		return rows;
	}

	public List<HeatmapCellRow> appointmentHeatmap(UUID organizationId, UUID siteId, LocalDate fromDay, LocalDate toDay) {
		Instant start = fromDay.atStartOfDay(ZoneOffset.UTC).toInstant();
		Instant end = toDay.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
		Query q = Query.query(Criteria.where("organization_id").is(organizationId)
				.and("site_id").is(siteId)
				.and("start_at").gte(start).lt(end)
				.and("status").in(AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED));
		List<Appointment> appointments = mongo.find(q, Appointment.class);
		Map<String, Long> counts = new HashMap<>();
		for (Appointment a : appointments) {
			if (a.getStartAt() == null) {
				continue;
			}
			var z = a.getStartAt().atZone(ZoneOffset.UTC);
			int dow = z.getDayOfWeek().getValue() % 7;
			int hour = z.getHour();
			String key = dow + ":" + hour;
			counts.merge(key, 1L, Long::sum);
		}
		List<HeatmapCellRow> rows = new ArrayList<>();
		for (Map.Entry<String, Long> e : counts.entrySet()) {
			String[] p = e.getKey().split(":");
			rows.add(new HeatmapCellRow(Integer.parseInt(p[0]), Integer.parseInt(p[1]), e.getValue()));
		}
		rows.sort(Comparator.comparingInt(HeatmapCellRow::dayOfWeek).thenComparingInt(HeatmapCellRow::hourOfDay));
		return rows;
	}

	private static LocalDate bucketFor(LocalDate day, String groupBy) {
		return switch (groupBy) {
			case "day" -> day;
			case "week" -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
			case "month" -> day.withDayOfMonth(1);
			case "year" -> day.withDayOfYear(1);
			default -> day;
		};
	}

	private static long longVal(Document doc, String key) {
		Object v = doc.get(key);
		if (v == null) {
			return 0L;
		}
		if (v instanceof Number n) {
			return n.longValue();
		}
		return 0L;
	}

	private static UUID toUuid(Object raw) {
		if (raw == null) {
			return null;
		}
		if (raw instanceof UUID u) {
			return u;
		}
		return UUID.fromString(raw.toString());
	}

	private record DoctorAgg(
			UUID professionalId,
			long appointmentsCreated,
			long appointmentsConfirmed,
			long appointmentsCancelled,
			long revenuePaidCents,
			long bookedMinutes
	) {}

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

	public record TrendBucketRow(
			LocalDate bucket,
			long total
	) {}

	public record HeatmapCellRow(
			int dayOfWeek,
			int hourOfDay,
			long total
	) {}
}
