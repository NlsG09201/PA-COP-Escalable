package com.COP_Escalable.Backend.odontogram.domain;

import java.util.ArrayList;
import java.util.List;

public class OrthodonticSimulation {
	private int plannedDurationMonths;
	private String notes;
	private List<SimulationKeyframe> keyframes = new ArrayList<>();

	public int getPlannedDurationMonths() { return plannedDurationMonths; }
	public void setPlannedDurationMonths(int plannedDurationMonths) { this.plannedDurationMonths = plannedDurationMonths; }
	public String getNotes() { return notes; }
	public void setNotes(String notes) { this.notes = notes; }
	public List<SimulationKeyframe> getKeyframes() { return keyframes; }
	public void setKeyframes(List<SimulationKeyframe> keyframes) { this.keyframes = keyframes != null ? keyframes : new ArrayList<>(); }
}
