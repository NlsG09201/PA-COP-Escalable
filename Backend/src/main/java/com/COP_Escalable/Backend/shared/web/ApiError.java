package com.COP_Escalable.Backend.shared.web;

import java.time.Instant;
import java.util.Map;

public record ApiError(
		String code,
		String message,
		Instant timestamp,
		Map<String, Object> details
) {
	public static ApiError of(String code, String message, Map<String, Object> details) {
		return new ApiError(code, message, Instant.now(), details == null ? Map.of() : details);
	}
}

