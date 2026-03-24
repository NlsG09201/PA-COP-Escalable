package com.COP_Escalable.Backend.aiassist.application;

final class AiJsonFence {

	private AiJsonFence() {}

	static String unwrap(String raw) {
		if (raw == null) {
			return "";
		}
		String s = raw.trim();
		if (!s.startsWith("```")) {
			return s;
		}
		int firstNl = s.indexOf('\n');
		if (firstNl < 0) {
			return s;
		}
		s = s.substring(firstNl + 1).trim();
		if (s.endsWith("```")) {
			s = s.substring(0, s.length() - 3).trim();
		}
		return s;
	}
}
