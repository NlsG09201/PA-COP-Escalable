package com.COP_Escalable.Backend.iam;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "IAM",
		allowedDependencies = {"shared", "tenancy"}
)
public class IamModule {
}

