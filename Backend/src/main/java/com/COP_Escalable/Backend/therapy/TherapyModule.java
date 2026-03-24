package com.COP_Escalable.Backend.therapy;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Therapy",
		allowedDependencies = {"shared", "patients", "psychology"}
)
public class TherapyModule {
}
