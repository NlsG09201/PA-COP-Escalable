package com.COP_Escalable.Backend.diagnosis.application;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;

@ConfigurationProperties(prefix = "app.diagnosis")
public class DiagnosisProperties {

	private String serviceUrl = "http://localhost:8090";
	private boolean async = true;
	private RedisStream redisStream = new RedisStream();

	@PostConstruct
	public void normalizeDefaults() {
		if (redisStream == null) {
			redisStream = new RedisStream();
		}
		redisStream.normalizeDefaults();
	}

	public String getServiceUrl() { return serviceUrl; }
	public void setServiceUrl(String serviceUrl) { this.serviceUrl = serviceUrl; }

	public boolean isAsync() { return async; }
	public void setAsync(boolean async) { this.async = async; }

	public RedisStream getRedisStream() { return redisStream; }
	public void setRedisStream(RedisStream redisStream) { this.redisStream = redisStream != null ? redisStream : new RedisStream(); }

	public static class RedisStream {
		private boolean enabled = true;
		private String requestsKey = "cop:diagnosis:requests";
		private String resultsKey = "cop:diagnosis:results";
		private String consumerGroup = "backend-diagnosis";
		private String consumerName = "";
		private long pollDelayMs = 2000L;
		private int batchSize = 10;
		private long readBlockMs = 1000L;
		private long claimIdleTimeMs = 60_000L;

		public boolean isEnabled() { return enabled; }
		public void setEnabled(boolean enabled) { this.enabled = enabled; }

		public String getRequestsKey() { return requestsKey; }
		public void setRequestsKey(String requestsKey) { this.requestsKey = requestsKey; }

		public String getResultsKey() { return resultsKey; }
		public void setResultsKey(String resultsKey) { this.resultsKey = resultsKey; }

		public String getConsumerGroup() { return consumerGroup; }
		public void setConsumerGroup(String consumerGroup) { this.consumerGroup = consumerGroup; }

		public String getConsumerName() { return consumerName; }
		public void setConsumerName(String consumerName) { this.consumerName = consumerName; }

		public long getPollDelayMs() { return pollDelayMs; }
		public void setPollDelayMs(long pollDelayMs) { this.pollDelayMs = pollDelayMs; }

		public int getBatchSize() { return batchSize; }
		public void setBatchSize(int batchSize) { this.batchSize = batchSize; }

		public long getReadBlockMs() { return readBlockMs; }
		public void setReadBlockMs(long readBlockMs) { this.readBlockMs = readBlockMs; }

		public long getClaimIdleTimeMs() { return claimIdleTimeMs; }
		public void setClaimIdleTimeMs(long claimIdleTimeMs) { this.claimIdleTimeMs = claimIdleTimeMs; }

		public String effectiveConsumerName() {
			if (consumerName != null && !consumerName.isBlank()) {
				return consumerName.trim();
			}
			return defaultConsumerName();
		}

		public void normalizeDefaults() {
			var d = new RedisStream();
			if (requestsKey == null || requestsKey.isBlank()) requestsKey = d.requestsKey;
			if (resultsKey == null || resultsKey.isBlank()) resultsKey = d.resultsKey;
			if (consumerGroup == null || consumerGroup.isBlank()) consumerGroup = d.consumerGroup;
			if (batchSize < 1) batchSize = d.batchSize;
			if (pollDelayMs < 100) pollDelayMs = d.pollDelayMs;
			if (readBlockMs < 100) readBlockMs = d.readBlockMs;
			if (claimIdleTimeMs < 1000) claimIdleTimeMs = d.claimIdleTimeMs;
		}

		private static String defaultConsumerName() {
			try {
				return "diagnosis-" + InetAddress.getLocalHost().getHostName() + "-" + UUID.randomUUID();
			} catch (UnknownHostException ex) {
				return "diagnosis-" + UUID.randomUUID();
			}
		}
	}
}
