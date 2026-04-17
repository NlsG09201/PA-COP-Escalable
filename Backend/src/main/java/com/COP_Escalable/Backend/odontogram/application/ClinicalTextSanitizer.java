package com.COP_Escalable.Backend.odontogram.application;

import org.springframework.stereotype.Component;

/**
 * Basic clinical text hardening: strips HTML-like tags and normalizes whitespace.
 * Not a substitute for output encoding at the edge, but reduces stored XSS payloads.
 */
@Component
public class ClinicalTextSanitizer {
	private static final int MAX = 4000;

	public String sanitize(String raw) {
		if (raw == null) return "";
		var s = raw.strip();
		if (s.length() > MAX) s = s.substring(0, MAX);
		s = s.replace('<', ' ').replace('>', ' ');
		s = s.replaceAll("\\s+", " ");
		return s.strip();
	}
}
