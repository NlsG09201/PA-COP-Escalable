package com.COP_Escalable.Backend.simulation;

import org.springframework.modulith.ApplicationModule;

@ApplicationModule(
		displayName = "Simulation",
		allowedDependencies = {"shared", "odontogram"}
)
public class SimulationModule {
}
