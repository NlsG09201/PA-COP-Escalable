package com.COP_Escalable.Backend.appointments.application;

public enum AppointmentEventType {
	CITA_CREADA("cita_creada"),
	CITA_CONFIRMADA("cita_confirmada"),
	CITA_CANCELADA("cita_cancelada");

	private final String code;

	AppointmentEventType(String code) {
		this.code = code;
	}

	public String code() {
		return code;
	}
}
