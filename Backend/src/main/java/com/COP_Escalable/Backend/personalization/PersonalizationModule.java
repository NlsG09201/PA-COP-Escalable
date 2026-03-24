package com.COP_Escalable.Backend.personalization;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Personalization",
		allowedDependencies = {"shared", "patients", "therapy", "psychology", "experience"}
)
public class PersonalizationModule {
}
