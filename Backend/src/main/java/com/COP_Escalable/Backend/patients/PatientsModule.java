package com.COP_Escalable.Backend.patients;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Patients",
		allowedDependencies = {"shared", "tenancy", "iam"}
)
public class PatientsModule {
}

