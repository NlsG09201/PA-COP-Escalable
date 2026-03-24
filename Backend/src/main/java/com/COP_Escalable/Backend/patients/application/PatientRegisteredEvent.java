package com.COP_Escalable.Backend.patients.application;

import java.time.Instant;
import java.util.UUID;

public record PatientRegisteredEvent(
		UUID organizationId,
		UUID siteId,
		UUID patientId,
		Instant createdAt
) {}
