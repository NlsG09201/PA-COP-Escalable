package com.COP_Escalable.Backend.analytics.infrastructure;

import com.COP_Escalable.Backend.analytics.domain.AnalyticsDailyProfessionalMetric;
import com.COP_Escalable.Backend.analytics.domain.AnalyticsDailySiteMetric;
import com.COP_Escalable.Backend.analytics.domain.AnalyticsDailySpecialtyMetric;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Incremental rollups stored in MongoDB (replaces PostgreSQL upserts).
 */
@Repository
public class AnalyticsRollupRepository {

	private final MongoTemplate mongo;

	public AnalyticsRollupRepository(MongoTemplate mongo) {
		this.mongo = mongo;
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
		String id = siteDocId(organizationId, siteId, day);
		Query q = Query.query(Criteria.where("_id").is(id));
		Update u = new Update()
				.inc("appointments_created", appointmentsCreated)
				.inc("appointments_confirmed", appointmentsConfirmed)
				.inc("appointments_cancelled", appointmentsCancelled)
				.inc("appointments_completed", appointmentsCompleted)
				.inc("patients_new", patientsNew)
				.inc("revenue_paid_cents", revenuePaidCents)
				.inc("booked_minutes", bookedMinutes)
				.setOnInsert("organization_id", organizationId)
				.setOnInsert("site_id", siteId)
				.setOnInsert("day", day);
		mongo.upsert(q, u, AnalyticsDailySiteMetric.class);
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
		String id = specialtyDocId(organizationId, siteId, day, specialty);
		Query q = Query.query(Criteria.where("_id").is(id));
		Update u = new Update()
				.inc("appointments_created", appointmentsCreated)
				.inc("appointments_confirmed", appointmentsConfirmed)
				.inc("appointments_cancelled", appointmentsCancelled)
				.inc("appointments_completed", appointmentsCompleted)
				.inc("revenue_paid_cents", revenuePaidCents)
				.inc("booked_minutes", bookedMinutes)
				.setOnInsert("organization_id", organizationId)
				.setOnInsert("site_id", siteId)
				.setOnInsert("day", day)
				.setOnInsert("specialty", specialty);
		mongo.upsert(q, u, AnalyticsDailySpecialtyMetric.class);
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
		String id = professionalDocId(organizationId, siteId, day, professionalId);
		Query q = Query.query(Criteria.where("_id").is(id));
		Update u = new Update()
				.inc("appointments_created", appointmentsCreated)
				.inc("appointments_confirmed", appointmentsConfirmed)
				.inc("appointments_cancelled", appointmentsCancelled)
				.inc("appointments_completed", appointmentsCompleted)
				.inc("revenue_paid_cents", revenuePaidCents)
				.inc("booked_minutes", bookedMinutes)
				.setOnInsert("organization_id", organizationId)
				.setOnInsert("site_id", siteId)
				.setOnInsert("day", day)
				.setOnInsert("professional_id", professionalId);
		mongo.upsert(q, u, AnalyticsDailyProfessionalMetric.class);
	}

	static String siteDocId(UUID organizationId, UUID siteId, LocalDate day) {
		return organizationId + "::" + siteId + "::" + day;
	}

	static String specialtyDocId(UUID organizationId, UUID siteId, LocalDate day, String specialty) {
		return organizationId + "::" + siteId + "::" + day + "::s:" + specialty;
	}

	static String professionalDocId(UUID organizationId, UUID siteId, LocalDate day, UUID professionalId) {
		return organizationId + "::" + siteId + "::" + day + "::p:" + professionalId;
	}
}
