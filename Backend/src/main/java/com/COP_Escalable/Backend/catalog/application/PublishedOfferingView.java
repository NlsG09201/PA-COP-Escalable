package com.COP_Escalable.Backend.catalog.application;

import java.util.List;
import java.util.UUID;

public record PublishedOfferingView(
		UUID offeringId,
		String categoryDisplayName,
		String title,
		String description,
		int durationMinutes,
		long basePrice,
		Long promoPrice,
		String badge,
		List<String> features,
		List<String> specialtyMatchTokens
) {
	public String publicId() {
		return offeringId.toString();
	}
}
