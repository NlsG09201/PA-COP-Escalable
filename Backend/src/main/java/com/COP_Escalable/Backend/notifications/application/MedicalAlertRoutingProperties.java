package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@ConfigurationProperties(prefix = "app.notifications.medical-alerts")
public record MedicalAlertRoutingProperties(
		Boolean enabled,
		Map<String, List<AlertAudience>> severityRoutes,
		Map<String, Map<String, List<AlertAudience>>> siteSeverityRoutes,
		AlertRecipients defaultContacts,
		Map<String, AlertRecipients> siteContacts
) {
	public MedicalAlertRoutingProperties {
		enabled = enabled == null ? true : enabled;
		severityRoutes = normalizeSeverityRoutes(severityRoutes);
		siteSeverityRoutes = normalizeSiteSeverityRoutes(siteSeverityRoutes);
		defaultContacts = defaultContacts == null ? AlertRecipients.empty() : defaultContacts.normalized();
		siteContacts = normalizeSiteContacts(siteContacts);
	}

	public List<AlertAudience> audiencesFor(UUID siteId, String severity) {
		var siteOverrides = siteId == null ? Map.<String, List<AlertAudience>>of() : siteSeverityRoutes.getOrDefault(siteId.toString(), Map.of());
		String normalizedSeverity = normalizeKey(severity);
		return siteOverrides.getOrDefault(normalizedSeverity, severityRoutes.getOrDefault(normalizedSeverity, defaultAudiencesFor(normalizedSeverity)));
	}

	public AlertRecipients contactsFor(UUID siteId) {
		if (siteId == null) {
			return defaultContacts;
		}
		return defaultContacts.merge(siteContacts.getOrDefault(siteId.toString(), AlertRecipients.empty()));
	}

	/**
	 * YAML defaults + optional YAML per-site lists, merged with contacts persisted per site in the database.
	 */
	public AlertRecipients contactsWithDatabaseOverlay(UUID siteId, AlertRecipients databaseOverlay) {
		var base = contactsFor(siteId);
		if (databaseOverlay == null) {
			return base;
		}
		return base.merge(databaseOverlay);
	}

	private static Map<String, List<AlertAudience>> normalizeSeverityRoutes(Map<String, List<AlertAudience>> routes) {
		var normalized = new LinkedHashMap<String, List<AlertAudience>>();
		normalized.put("low", List.of(AlertAudience.PATIENT));
		normalized.put("medium", List.of(AlertAudience.PATIENT));
		normalized.put("high", List.of(AlertAudience.PATIENT, AlertAudience.PROFESSIONALS));
		normalized.put("critical", List.of(AlertAudience.PATIENT, AlertAudience.PROFESSIONALS, AlertAudience.ADMINS));
		if (routes == null) {
			return Map.copyOf(normalized);
		}
		for (var entry : routes.entrySet()) {
			normalized.put(normalizeKey(entry.getKey()), normalizeAudienceList(entry.getValue()));
		}
		return Map.copyOf(normalized);
	}

	private static Map<String, Map<String, List<AlertAudience>>> normalizeSiteSeverityRoutes(
			Map<String, Map<String, List<AlertAudience>>> routes
	) {
		if (routes == null || routes.isEmpty()) {
			return Map.of();
		}
		var normalized = new LinkedHashMap<String, Map<String, List<AlertAudience>>>();
		for (var siteEntry : routes.entrySet()) {
			var siteRoutes = new LinkedHashMap<String, List<AlertAudience>>();
			if (siteEntry.getValue() != null) {
				for (var severityEntry : siteEntry.getValue().entrySet()) {
					siteRoutes.put(normalizeKey(severityEntry.getKey()), normalizeAudienceList(severityEntry.getValue()));
				}
			}
			normalized.put(siteEntry.getKey(), Map.copyOf(siteRoutes));
		}
		return Map.copyOf(normalized);
	}

	private static Map<String, AlertRecipients> normalizeSiteContacts(Map<String, AlertRecipients> contacts) {
		if (contacts == null || contacts.isEmpty()) {
			return Map.of();
		}
		var normalized = new LinkedHashMap<String, AlertRecipients>();
		for (var entry : contacts.entrySet()) {
			normalized.put(entry.getKey(), entry.getValue() == null ? AlertRecipients.empty() : entry.getValue().normalized());
		}
		return Map.copyOf(normalized);
	}

	private static List<AlertAudience> normalizeAudienceList(List<AlertAudience> audiences) {
		if (audiences == null || audiences.isEmpty()) {
			return List.of(AlertAudience.PATIENT);
		}
		return List.copyOf(new LinkedHashSet<>(audiences));
	}

	private static List<AlertAudience> defaultAudiencesFor(String severity) {
		return switch (severity) {
			case "critical" -> List.of(AlertAudience.PATIENT, AlertAudience.PROFESSIONALS, AlertAudience.ADMINS);
			case "high" -> List.of(AlertAudience.PATIENT, AlertAudience.PROFESSIONALS);
			default -> List.of(AlertAudience.PATIENT);
		};
	}

	private static String normalizeKey(String value) {
		if (value == null || value.isBlank()) {
			return "high";
		}
		return value.trim().toLowerCase(Locale.ROOT);
	}

	public record AlertRecipients(
			AudienceContacts professionals,
			AudienceContacts admins
	) {
		private static AlertRecipients empty() {
			return new AlertRecipients(AudienceContacts.empty(), AudienceContacts.empty());
		}

		private AlertRecipients normalized() {
			return new AlertRecipients(
					professionals == null ? AudienceContacts.empty() : professionals.normalized(),
					admins == null ? AudienceContacts.empty() : admins.normalized()
			);
		}

		private AlertRecipients merge(AlertRecipients other) {
			if (other == null) {
				return this;
			}
			return new AlertRecipients(
					professionals.merge(other.professionals),
					admins.merge(other.admins)
			);
		}
	}

	public record AudienceContacts(
			List<String> email,
			List<String> whatsapp
	) {
		private static AudienceContacts empty() {
			return new AudienceContacts(List.of(), List.of());
		}

		private AudienceContacts normalized() {
			return new AudienceContacts(
					normalizeRecipients(email),
					normalizeRecipients(whatsapp)
			);
		}

		private AudienceContacts merge(AudienceContacts other) {
			if (other == null) {
				return this;
			}
			return new AudienceContacts(
					mergeRecipients(email, other.email),
					mergeRecipients(whatsapp, other.whatsapp)
			);
		}

		private static List<String> normalizeRecipients(List<String> values) {
			if (values == null || values.isEmpty()) {
				return List.of();
			}
			var normalized = new LinkedHashSet<String>();
			for (var value : values) {
				if (value != null && !value.isBlank()) {
					normalized.add(value.trim());
				}
			}
			return List.copyOf(normalized);
		}

		private static List<String> mergeRecipients(List<String> left, List<String> right) {
			var merged = new ArrayList<String>();
			if (left != null) {
				merged.addAll(left);
			}
			if (right != null) {
				merged.addAll(right);
			}
			return normalizeRecipients(merged);
		}
	}
}
