package com.COP_Escalable.Backend.experience.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties("app.experience")
public class ExperienceProperties {

	private boolean npsEnabled = true;
	private int surveyCooldownDays = 30;

	public boolean isNpsEnabled() { return npsEnabled; }
	public void setNpsEnabled(boolean npsEnabled) { this.npsEnabled = npsEnabled; }

	public int getSurveyCooldownDays() { return surveyCooldownDays; }
	public void setSurveyCooldownDays(int surveyCooldownDays) {
		this.surveyCooldownDays = surveyCooldownDays;
	}
}
