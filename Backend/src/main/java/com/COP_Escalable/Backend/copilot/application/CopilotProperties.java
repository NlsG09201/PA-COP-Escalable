package com.COP_Escalable.Backend.copilot.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties("app.copilot")
public class CopilotProperties {

	private boolean enabled = true;
	private int maxSuggestionsPerSession = 20;

	public boolean isEnabled() { return enabled; }
	public void setEnabled(boolean enabled) { this.enabled = enabled; }

	public int getMaxSuggestionsPerSession() { return maxSuggestionsPerSession; }
	public void setMaxSuggestionsPerSession(int maxSuggestionsPerSession) {
		this.maxSuggestionsPerSession = maxSuggestionsPerSession;
	}
}
