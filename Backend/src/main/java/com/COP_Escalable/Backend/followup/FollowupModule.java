package com.COP_Escalable.Backend.followup;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Followup",
		allowedDependencies = {"shared", "patients", "appointments"}
)
public class FollowupModule {
}
