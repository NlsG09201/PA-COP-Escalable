package com.COP_Escalable.Backend.publicbooking.infrastructure;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class PublicBookingRepositoryImpl implements PublicBookingRepositoryCustom {

	private final MongoTemplate mongoTemplate;

	public PublicBookingRepositoryImpl(MongoTemplate mongoTemplate) {
		this.mongoTemplate = mongoTemplate;
	}

	@Override
	public boolean existsActiveOverlap(
			UUID organizationId,
			UUID siteId,
			UUID professionalId,
			Instant startAt,
			Instant endAt,
			Instant now
	) {
		Criteria window = new Criteria().andOperator(
				Criteria.where("organization_id").is(organizationId),
				Criteria.where("site_id").is(siteId),
				Criteria.where("professional_id").is(professionalId),
				Criteria.where("appointment_start_at").lt(endAt),
				Criteria.where("appointment_end_at").gt(startAt)
		);
		Criteria statusOk = new Criteria().orOperator(
				Criteria.where("status").is(PublicBooking.Status.CONFIRMED),
				new Criteria().andOperator(
						Criteria.where("status").is(PublicBooking.Status.PENDING_PAYMENT),
						Criteria.where("expires_at").gt(now)
				)
		);
		Query query = new Query(new Criteria().andOperator(window, statusOk));
		return mongoTemplate.exists(query, PublicBooking.class);
	}
}
