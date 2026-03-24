package com.COP_Escalable.Backend.catalog.application;

import java.time.Instant;
import java.util.UUID;

public record ManagedServiceView(
		UUID id,
		String name,
		String description,
		ServiceCatalogCategory category,
		long price,
		Integer duration,
		boolean active,
		Instant createdAt
) {}
