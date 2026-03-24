package com.COP_Escalable.Backend.followup.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties("app.followup")
public class FollowupProperties {

	private boolean enabled = true;
	private int surveyDelayDays = 7;
	private List<Integer> controlAppointmentDays = List.of(30, 90, 180);

	public boolean isEnabled() { return enabled; }
	public void setEnabled(boolean enabled) { this.enabled = enabled; }

	public int getSurveyDelayDays() { return surveyDelayDays; }
	public void setSurveyDelayDays(int surveyDelayDays) { this.surveyDelayDays = surveyDelayDays; }

	public List<Integer> getControlAppointmentDays() { return controlAppointmentDays; }
	public void setControlAppointmentDays(List<Integer> controlAppointmentDays) { this.controlAppointmentDays = controlAppointmentDays; }
}
