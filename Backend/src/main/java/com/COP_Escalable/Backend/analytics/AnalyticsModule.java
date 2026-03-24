package com.COP_Escalable.Backend.analytics;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Analytics",
		allowedDependencies = {"shared", "appointments", "tenancy", "publicbooking", "patients"}
)
public class AnalyticsModule {}
