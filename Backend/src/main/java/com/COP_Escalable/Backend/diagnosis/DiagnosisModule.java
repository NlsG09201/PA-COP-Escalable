package com.COP_Escalable.Backend.diagnosis;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Diagnosis",
		allowedDependencies = {"shared", "patients", "odontogram"}
)
public class DiagnosisModule {
}
