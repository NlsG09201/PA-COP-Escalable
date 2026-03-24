package com.COP_Escalable.Backend.simulation.domain;

public class ToothTransform {

	private String toothCode;
	private double translationX;
	private double translationY;
	private double translationZ;
	private double rotationX;
	private double rotationY;
	private double rotationZ;
	private String status;
	private boolean visible;

	protected ToothTransform() {}

	public ToothTransform(String toothCode, double translationX, double translationY, double translationZ,
						  double rotationX, double rotationY, double rotationZ, String status, boolean visible) {
		this.toothCode = toothCode;
		this.translationX = translationX;
		this.translationY = translationY;
		this.translationZ = translationZ;
		this.rotationX = rotationX;
		this.rotationY = rotationY;
		this.rotationZ = rotationZ;
		this.status = status;
		this.visible = visible;
	}

	public static ToothTransform identity(String toothCode, String status) {
		return new ToothTransform(toothCode, 0, 0, 0, 0, 0, 0, status, true);
	}

	public static ToothTransform withTranslation(String toothCode, double tx, double ty, double tz, String status) {
		return new ToothTransform(toothCode, tx, ty, tz, 0, 0, 0, status, true);
	}

	public static ToothTransform withRotation(String toothCode, double rx, double ry, double rz, String status) {
		return new ToothTransform(toothCode, 0, 0, 0, rx, ry, rz, status, true);
	}

	public static ToothTransform full(String toothCode, double tx, double ty, double tz,
									  double rx, double ry, double rz, String status, boolean visible) {
		return new ToothTransform(toothCode, tx, ty, tz, rx, ry, rz, status, visible);
	}

	public String getToothCode() { return toothCode; }
	public void setToothCode(String toothCode) { this.toothCode = toothCode; }

	public double getTranslationX() { return translationX; }
	public void setTranslationX(double translationX) { this.translationX = translationX; }

	public double getTranslationY() { return translationY; }
	public void setTranslationY(double translationY) { this.translationY = translationY; }

	public double getTranslationZ() { return translationZ; }
	public void setTranslationZ(double translationZ) { this.translationZ = translationZ; }

	public double getRotationX() { return rotationX; }
	public void setRotationX(double rotationX) { this.rotationX = rotationX; }

	public double getRotationY() { return rotationY; }
	public void setRotationY(double rotationY) { this.rotationY = rotationY; }

	public double getRotationZ() { return rotationZ; }
	public void setRotationZ(double rotationZ) { this.rotationZ = rotationZ; }

	public String getStatus() { return status; }
	public void setStatus(String status) { this.status = status; }

	public boolean isVisible() { return visible; }
	public void setVisible(boolean visible) { this.visible = visible; }
}
