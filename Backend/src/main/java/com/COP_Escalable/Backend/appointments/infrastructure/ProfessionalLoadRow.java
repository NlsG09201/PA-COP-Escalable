package com.COP_Escalable.Backend.appointments.infrastructure;

import java.util.UUID;

public record ProfessionalLoadRow(
		UUID professionalId,
		long total
) {}
