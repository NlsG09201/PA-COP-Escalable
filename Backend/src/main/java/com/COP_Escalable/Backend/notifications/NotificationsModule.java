package com.COP_Escalable.Backend.notifications;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Notifications",
		allowedDependencies = {"shared", "appointments", "patients", "tenancy"}
)
public class NotificationsModule {
}
