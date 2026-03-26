package com.COP_Escalable.Backend.publicbooking.infrastructure;

import java.time.Instant;
import java.util.UUID;

public interface PublicBookingRepositoryCustom {

	boolean existsActiveOverlap(
			UUID organizationId,
			UUID siteId,
			UUID professionalId,
			Instant startAt,
			Instant endAt,
			Instant now
	);
}
