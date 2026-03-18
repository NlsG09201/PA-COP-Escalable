package com.COP_Escalable.Backend.appointments;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Appointments",
		allowedDependencies = {"shared", "tenancy", "iam", "patients"}
)
public class AppointmentsModule {
}

