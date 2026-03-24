package com.COP_Escalable.Backend.diagnosis.domain;

import java.util.List;

public class Finding {

	private String label;
	private double confidence;
	private String description;
	private List<Double> boundingBox;

	protected Finding() {}

	public Finding(String label, double confidence, String description, List<Double> boundingBox) {
		this.label = label;
		this.confidence = confidence;
		this.description = description;
		this.boundingBox = boundingBox;
	}

	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }

	public double getConfidence() { return confidence; }
	public void setConfidence(double confidence) { this.confidence = confidence; }

	public String getDescription() { return description; }
	public void setDescription(String description) { this.description = description; }

	public List<Double> getBoundingBox() { return boundingBox; }
	public void setBoundingBox(List<Double> boundingBox) { this.boundingBox = boundingBox; }
}
