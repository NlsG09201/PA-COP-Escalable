package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
public class AppointmentRepositoryImpl implements AppointmentRepositoryCustom {

	private final MongoTemplate mongoTemplate;

	public AppointmentRepositoryImpl(MongoTemplate mongoTemplate) {
		this.mongoTemplate = mongoTemplate;
	}

	@Override
	public List<Appointment> findPageWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status,
			Pageable pageable
	) {
		Query q = baseRangeQuery(organizationId, siteId, from, to);
		if (professionalId != null) {
			q.addCriteria(Criteria.where("professionalId").is(professionalId));
		}
		if (status != null) {
			q.addCriteria(Criteria.where("status").is(status));
		}
		q.with(pageable);
		if (pageable.getSort().isSorted()) {
			q.with(pageable.getSort());
		} else {
			q.with(Sort.by(Sort.Direction.ASC, "startAt"));
		}
		return mongoTemplate.find(q, Appointment.class);
	}

	@Override
	public long countWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status
	) {
		Query q = baseRangeQuery(organizationId, siteId, from, to);
		if (professionalId != null) {
			q.addCriteria(Criteria.where("professionalId").is(professionalId));
		}
		if (status != null) {
			q.addCriteria(Criteria.where("status").is(status));
		}
		return mongoTemplate.count(q, Appointment.class);
	}

	private static Query baseRangeQuery(UUID organizationId, UUID siteId, Instant from, Instant to) {
		return new Query(
				Criteria.where("organizationId").is(organizationId)
						.and("siteId").is(siteId)
						.and("startAt").gte(from).lte(to)
		);
	}

	@Override
	public boolean existsOverlapping(UUID organizationId, UUID siteId, UUID professionalId, Instant startAt, Instant endAt) {
		Query q = new Query(
				Criteria.where("organizationId").is(organizationId)
						.and("siteId").is(siteId)
						.and("professionalId").is(professionalId)
						.and("status").in(AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED)
						.and("startAt").lt(endAt)
						.and("endAt").gt(startAt)
		);
		return mongoTemplate.exists(q, Appointment.class);
	}

	@Override
	public List<ProfessionalLoadRow> countLoadByProfessional(UUID organizationId, UUID siteId, Instant from, Instant to) {
		Query q = new Query(
				Criteria.where("organizationId").is(organizationId)
						.and("siteId").is(siteId)
						.and("startAt").gte(from).lte(to)
						.and("status").in(AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED)
		);
		List<Appointment> all = mongoTemplate.find(q, Appointment.class);
		var map = all.stream().collect(Collectors.groupingBy(Appointment::getProfessionalId, Collectors.counting()));
		List<ProfessionalLoadRow> rows = new ArrayList<>();
		map.forEach((pid, cnt) -> rows.add(new ProfessionalLoadRow(pid, cnt)));
		return rows;
	}

	@Override
	public long countProfessionalDayLoad(UUID organizationId, UUID siteId, UUID professionalId, Instant from, Instant to) {
		Query q = new Query(
				Criteria.where("organizationId").is(organizationId)
						.and("siteId").is(siteId)
						.and("professionalId").is(professionalId)
						.and("startAt").gte(from).lt(to)
						.and("status").in(AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED)
		);
		return mongoTemplate.count(q, Appointment.class);
	}
}
