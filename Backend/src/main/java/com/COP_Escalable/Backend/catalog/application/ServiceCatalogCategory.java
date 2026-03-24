package com.COP_Escalable.Backend.catalog.application;

import java.util.Locale;

public enum ServiceCatalogCategory {
	ODONTOLOGIA("odontologia"),
	PSICOLOGIA("psicologia");

	private final String slug;

	ServiceCatalogCategory(String slug) {
		this.slug = slug;
	}

	public String slug() {
		return slug;
	}

	public static ServiceCatalogCategory parse(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new IllegalArgumentException("category is required");
		}
		String normalized = raw.trim().toUpperCase(Locale.ROOT);
		try {
			return ServiceCatalogCategory.valueOf(normalized);
		} catch (IllegalArgumentException ex) {
			throw new IllegalArgumentException("Invalid category. Allowed: ODONTOLOGIA, PSICOLOGIA");
		}
	}
}
