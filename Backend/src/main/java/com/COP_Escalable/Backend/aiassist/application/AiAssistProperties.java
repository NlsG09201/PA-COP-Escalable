package com.COP_Escalable.Backend.aiassist.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.ai-assist")
public class AiAssistProperties {

	public enum Provider {
		STUB,
		OPENAI_COMPAT
	}

	private boolean enabled = true;
	private boolean async = true;
	private boolean validateOutputSchema = true;
	private Provider provider = Provider.STUB;
	private String baseUrl = "https://api.openai.com";
	private String apiKey = "";
	private String model = "gpt-4o-mini";
	private String promptVersion = "v1";
	private boolean alertOnCritical = false;
	private Duration httpTimeout = Duration.ofSeconds(60);

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	public boolean isAsync() {
		return async;
	}

	public void setAsync(boolean async) {
		this.async = async;
	}

	public boolean isValidateOutputSchema() {
		return validateOutputSchema;
	}

	public void setValidateOutputSchema(boolean validateOutputSchema) {
		this.validateOutputSchema = validateOutputSchema;
	}

	public Provider getProvider() {
		return provider;
	}

	public void setProvider(Provider provider) {
		this.provider = provider;
	}

	public String getBaseUrl() {
		return baseUrl;
	}

	public void setBaseUrl(String baseUrl) {
		this.baseUrl = baseUrl;
	}

	public String getApiKey() {
		return apiKey;
	}

	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public String getPromptVersion() {
		return promptVersion;
	}

	public void setPromptVersion(String promptVersion) {
		this.promptVersion = promptVersion;
	}

	public boolean isAlertOnCritical() {
		return alertOnCritical;
	}

	public void setAlertOnCritical(boolean alertOnCritical) {
		this.alertOnCritical = alertOnCritical;
	}

	public Duration getHttpTimeout() {
		return httpTimeout;
	}

	public void setHttpTimeout(Duration httpTimeout) {
		this.httpTimeout = httpTimeout;
	}
}
