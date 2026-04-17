package com.COP_Escalable.Backend.odontogram.domain;

/**
 * Lightweight 3D pose for orthodontic simulation keyframes (Euler radians, local space).
 */
public class ToothPose {
	private double rotX;
	private double rotY;
	private double rotZ;
	private double offsetMmX;
	private double offsetMmY;
	private double offsetMmZ;

	public ToothPose() {}

	public ToothPose(double rotX, double rotY, double rotZ, double offsetMmX, double offsetMmY, double offsetMmZ) {
		this.rotX = rotX;
		this.rotY = rotY;
		this.rotZ = rotZ;
		this.offsetMmX = offsetMmX;
		this.offsetMmY = offsetMmY;
		this.offsetMmZ = offsetMmZ;
	}

	public double getRotX() { return rotX; }
	public void setRotX(double rotX) { this.rotX = rotX; }
	public double getRotY() { return rotY; }
	public void setRotY(double rotY) { this.rotY = rotY; }
	public double getRotZ() { return rotZ; }
	public void setRotZ(double rotZ) { this.rotZ = rotZ; }
	public double getOffsetMmX() { return offsetMmX; }
	public void setOffsetMmX(double offsetMmX) { this.offsetMmX = offsetMmX; }
	public double getOffsetMmY() { return offsetMmY; }
	public void setOffsetMmY(double offsetMmY) { this.offsetMmY = offsetMmY; }
	public double getOffsetMmZ() { return offsetMmZ; }
	public void setOffsetMmZ(double offsetMmZ) { this.offsetMmZ = offsetMmZ; }
}
