package com.COP_Escalable.Backend.aiassist.application;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.UUID;

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
	private RedisStream redisStream = new RedisStream();

	@PostConstruct
	public void normalizeRedisStreamDefaults() {
		if (redisStream == null) {
			redisStream = new RedisStream();
		}
		redisStream.normalizeDefaults();
	}

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

	public RedisStream getRedisStream() {
		return redisStream;
	}

	public void setRedisStream(RedisStream redisStream) {
		this.redisStream = redisStream != null ? redisStream : new RedisStream();
	}

	/**
	 * Cola de análisis vía Redis Streams (varios workers, reclamo de pendientes).
	 */
	public static class RedisStream {
		private boolean enabled = true;
		private String streamKey = "cop:ai-assist:analysis";
		private String consumerGroup = "ai-assist-workers";
		private String consumerName = "";
		private int batchSize = 10;
		private long consumerPollDelayMs = 1000L;
		private long readBlockMs = 1000L;
		private long claimIdleTimeMs = 60_000L;

		public boolean isEnabled() {
			return enabled;
		}

		public void setEnabled(boolean enabled) {
			this.enabled = enabled;
		}

		public String getStreamKey() {
			return streamKey;
		}

		public void setStreamKey(String streamKey) {
			this.streamKey = streamKey;
		}

		public String getConsumerGroup() {
			return consumerGroup;
		}

		public void setConsumerGroup(String consumerGroup) {
			this.consumerGroup = consumerGroup;
		}

		public String getConsumerName() {
			return consumerName;
		}

		public void setConsumerName(String consumerName) {
			this.consumerName = consumerName;
		}

		public int getBatchSize() {
			return batchSize;
		}

		public void setBatchSize(int batchSize) {
			this.batchSize = batchSize;
		}

		public long getConsumerPollDelayMs() {
			return consumerPollDelayMs;
		}

		public void setConsumerPollDelayMs(long consumerPollDelayMs) {
			this.consumerPollDelayMs = consumerPollDelayMs;
		}

		public long getReadBlockMs() {
			return readBlockMs;
		}

		public void setReadBlockMs(long readBlockMs) {
			this.readBlockMs = readBlockMs;
		}

		public long getClaimIdleTimeMs() {
			return claimIdleTimeMs;
		}

		public void setClaimIdleTimeMs(long claimIdleTimeMs) {
			this.claimIdleTimeMs = claimIdleTimeMs;
		}

		public String effectiveConsumerName() {
			if (consumerName != null && !consumerName.isBlank()) {
				return consumerName.trim();
			}
			return defaultConsumerName();
		}

		public void normalizeDefaults() {
			var d = new RedisStream();
			if (streamKey == null || streamKey.isBlank()) {
				streamKey = d.streamKey;
			}
			if (consumerGroup == null || consumerGroup.isBlank()) {
				consumerGroup = d.consumerGroup;
			}
			if (batchSize < 1) {
				batchSize = d.batchSize;
			}
			if (consumerPollDelayMs < 100) {
				consumerPollDelayMs = d.consumerPollDelayMs;
			}
			if (readBlockMs < 100) {
				readBlockMs = d.readBlockMs;
			}
			if (claimIdleTimeMs < 1000) {
				claimIdleTimeMs = d.claimIdleTimeMs;
			}
		}

		private static String defaultConsumerName() {
			try {
				return "ai-assist-" + InetAddress.getLocalHost().getHostName() + "-" + UUID.randomUUID();
			} catch (UnknownHostException ex) {
				return "ai-assist-" + UUID.randomUUID();
			}
		}
	}
}
