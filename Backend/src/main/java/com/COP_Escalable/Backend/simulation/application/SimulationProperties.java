package com.COP_Escalable.Backend.simulation.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.simulation")
public class SimulationProperties {

	private int maxPhases = 24;
	private double toothMovementRateMmPerMonth = 0.75;

	public int getMaxPhases() { return maxPhases; }
	public void setMaxPhases(int maxPhases) { this.maxPhases = maxPhases; }

	public double getToothMovementRateMmPerMonth() { return toothMovementRateMmPerMonth; }
	public void setToothMovementRateMmPerMonth(double toothMovementRateMmPerMonth) { this.toothMovementRateMmPerMonth = toothMovementRateMmPerMonth; }
}
