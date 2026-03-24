package com.COP_Escalable.Backend.diagnosis.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamReadOptions;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
@ConditionalOnBean(StringRedisTemplate.class)
@ConditionalOnProperty(prefix = "app.diagnosis.redis-stream", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DiagnosisResultConsumer {

	private static final Logger log = LoggerFactory.getLogger(DiagnosisResultConsumer.class);

	private final StringRedisTemplate redisTemplate;
	private final DiagnosisProperties properties;
	private final DiagnosisService diagnosisService;
	private final String consumerName;

	public DiagnosisResultConsumer(
			StringRedisTemplate redisTemplate,
			DiagnosisProperties properties,
			DiagnosisService diagnosisService
	) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
		this.diagnosisService = diagnosisService;
		this.consumerName = properties.getRedisStream().effectiveConsumerName();
	}

	@Scheduled(fixedDelayString = "${app.diagnosis.redis-stream.poll-delay-ms:2000}")
	public void poll() {
		if (!properties.isAsync() || !properties.getRedisStream().isEnabled()) {
			return;
		}
		try {
			ensureConsumerGroup();
			processClaimedMessages();
			processRecords(readNewMessages());
		} catch (RuntimeException ex) {
			log.warn("Diagnosis result stream poll failed: {}", ex.getMessage());
		}
	}

	private void ensureConsumerGroup() {
		var rs = properties.getRedisStream();
		try {
			redisTemplate.opsForStream().createGroup(
					rs.getResultsKey(),
					ReadOffset.latest(),
					rs.getConsumerGroup()
			);
		} catch (RuntimeException ex) {
			if (ex.getMessage() == null || !ex.getMessage().contains("BUSYGROUP")) {
				throw ex;
			}
		}
	}

	private void processClaimedMessages() {
		var rs = properties.getRedisStream();
		var pending = redisTemplate.opsForStream().pending(
				rs.getResultsKey(),
				rs.getConsumerGroup(),
				Range.unbounded(),
				rs.getBatchSize(),
				Duration.ofMillis(rs.getClaimIdleTimeMs())
		);
		if (pending == null || pending.isEmpty()) return;

		for (var pendingMessage : pending) {
			var claimed = redisTemplate.opsForStream().claim(
					rs.getResultsKey(),
					rs.getConsumerGroup(),
					consumerName,
					Duration.ofMillis(rs.getClaimIdleTimeMs()),
					pendingMessage.getId()
			);
			processRecords(claimed);
		}
	}

	private List<MapRecord<String, Object, Object>> readNewMessages() {
		var rs = properties.getRedisStream();
		return redisTemplate.opsForStream().read(
				Consumer.from(rs.getConsumerGroup(), consumerName),
				StreamReadOptions.empty()
						.count(rs.getBatchSize())
						.block(Duration.ofMillis(rs.getReadBlockMs())),
				StreamOffset.create(rs.getResultsKey(), ReadOffset.lastConsumed())
		);
	}

	private void processRecords(List<MapRecord<String, Object, Object>> records) {
		if (records == null || records.isEmpty()) return;

		for (var record : records) {
			var rawImageId = record.getValue().get("imageId");
			if (rawImageId == null) {
				acknowledge(record);
				continue;
			}

			String imageId = rawImageId.toString();
			Object rawData = record.getValue().get("data");
			String resultJson = rawData != null ? rawData.toString() : "{}";

			try {
				diagnosisService.processAsyncResult(imageId, resultJson);
				acknowledge(record);
			} catch (RuntimeException ex) {
				log.error("Diagnosis result record {} failed and remains pending for retry", record.getId(), ex);
			}
		}
	}

	private void acknowledge(MapRecord<String, Object, Object> record) {
		var rs = properties.getRedisStream();
		redisTemplate.opsForStream().acknowledge(
				rs.getResultsKey(),
				rs.getConsumerGroup(),
				record.getId()
		);
	}
}
