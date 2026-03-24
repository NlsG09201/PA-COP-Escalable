package com.COP_Escalable.Backend.aiassist;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "AI clinical assist",
		allowedDependencies = {"shared", "psychtests", "patients", "clinical"}
)
public class AiAssistModule {
}
