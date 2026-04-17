package com.COP_Escalable.Backend.odontogram.application;

import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class ToothFdiValidator {
	private static final Set<String> PERMANENT = Set.of(
			"18", "17", "16", "15", "14", "13", "12", "11",
			"21", "22", "23", "24", "25", "26", "27", "28",
			"48", "47", "46", "45", "44", "43", "42", "41",
			"31", "32", "33", "34", "35", "36", "37", "38"
	);

	public void requireValid(String tooth) {
		if (tooth == null || tooth.isBlank()) throw new IllegalArgumentException("tooth is required");
		var t = tooth.trim();
		if (!PERMANENT.contains(t)) throw new IllegalArgumentException("Invalid FDI tooth code: " + t);
	}

	public boolean isValid(String tooth) {
		try {
			requireValid(tooth);
			return true;
		} catch (IllegalArgumentException e) {
			return false;
		}
	}
}
