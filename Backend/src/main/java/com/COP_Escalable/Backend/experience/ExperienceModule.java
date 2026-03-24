package com.COP_Escalable.Backend.experience;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Patient Experience",
		allowedDependencies = {"shared", "patients"}
)
public class ExperienceModule {
}
