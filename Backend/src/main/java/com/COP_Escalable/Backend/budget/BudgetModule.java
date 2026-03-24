package com.COP_Escalable.Backend.budget;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Budget",
		allowedDependencies = {"shared", "patients", "odontology", "catalog"}
)
public class BudgetModule {
}
