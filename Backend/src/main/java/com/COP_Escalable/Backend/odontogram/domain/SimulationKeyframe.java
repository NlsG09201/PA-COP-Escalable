package com.COP_Escalable.Backend.odontogram.domain;

import java.util.HashMap;
import java.util.Map;

/**
 * Normalized time {@code t} in [0,1] across treatment; tooth poses keyed by FDI code.
 */
public class SimulationKeyframe {
	private double t;
	private Map<String, ToothPose> toothPoses = new HashMap<>();

	public double getT() { return t; }
	public void setT(double t) { this.t = t; }
	public Map<String, ToothPose> getToothPoses() { return toothPoses; }
	public void setToothPoses(Map<String, ToothPose> toothPoses) { this.toothPoses = toothPoses != null ? toothPoses : new HashMap<>(); }
}
