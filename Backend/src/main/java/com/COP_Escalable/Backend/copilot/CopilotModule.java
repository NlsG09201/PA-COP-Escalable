package com.COP_Escalable.Backend.copilot;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Clinical Copilot",
		allowedDependencies = {"shared", "patients", "clinical", "aiassist"}
)
public class CopilotModule {
}
