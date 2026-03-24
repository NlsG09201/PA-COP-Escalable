package com.COP_Escalable.Backend.relapse;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Relapse Risk",
		allowedDependencies = {"shared", "patients", "psychology", "therapy"}
)
public class RelapseModule {
}
