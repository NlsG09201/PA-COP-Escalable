package com.COP_Escalable.Backend.decisions;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Clinical Decisions",
		allowedDependencies = {"shared", "patients", "clinical"}
)
public class DecisionsModule {
}
