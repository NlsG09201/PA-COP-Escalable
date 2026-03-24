package com.COP_Escalable.Backend.simulation.domain;

import java.util.LinkedHashMap;
import java.util.Map;

public class SimulationPhase {

	private int phaseNumber;
	private String name;
	private int durationMonths;
	private Map<String, ToothTransform> toothStates = new LinkedHashMap<>();
	private String description;

	protected SimulationPhase() {}

	public SimulationPhase(int phaseNumber, String name, int durationMonths, String description) {
		this.phaseNumber = phaseNumber;
		this.name = name;
		this.durationMonths = durationMonths;
		this.description = description;
	}

	public void addToothState(String toothCode, ToothTransform transform) {
		this.toothStates.put(toothCode, transform);
	}

	public int getPhaseNumber() { return phaseNumber; }
	public void setPhaseNumber(int phaseNumber) { this.phaseNumber = phaseNumber; }

	public String getName() { return name; }
	public void setName(String name) { this.name = name; }

	public int getDurationMonths() { return durationMonths; }
	public void setDurationMonths(int durationMonths) { this.durationMonths = durationMonths; }

	public Map<String, ToothTransform> getToothStates() { return toothStates; }
	public void setToothStates(Map<String, ToothTransform> toothStates) { this.toothStates = toothStates; }

	public String getDescription() { return description; }
	public void setDescription(String description) { this.description = description; }
}
