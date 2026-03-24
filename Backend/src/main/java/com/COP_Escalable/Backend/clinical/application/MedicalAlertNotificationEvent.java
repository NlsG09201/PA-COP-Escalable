package com.COP_Escalable.Backend.clinical.application;

import java.time.Instant;
import java.util.UUID;

public record MedicalAlertNotificationEvent(
		UUID organizationId,
		UUID siteId,
		UUID patientId,
		UUID clinicalRecordId,
		String title,
		String message,
		String severity,
		String authorUsername,
		Instant occurredAt
) {
	public static final String EVENT_TYPE = "alerta_medica";

	public String eventTypeCode() {
		return EVENT_TYPE;
	}
}
