package com.COP_Escalable.Backend.portal;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Patient Portal",
		allowedDependencies = {"shared", "patients", "clinical", "odontogram", "psychology",
				"appointments", "therapy", "odontology"}
)
public class PortalModule {
}
