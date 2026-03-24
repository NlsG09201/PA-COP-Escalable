package com.COP_Escalable.Backend.therapy.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.therapy")
public class TherapyProperties {

	private boolean enabled = true;
	private int maxDailySessions = 3;

	public boolean isEnabled() { return enabled; }
	public void setEnabled(boolean enabled) { this.enabled = enabled; }

	public int getMaxDailySessions() { return maxDailySessions; }
	public void setMaxDailySessions(int maxDailySessions) { this.maxDailySessions = maxDailySessions; }
}
