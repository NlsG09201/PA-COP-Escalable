package com.COP_Escalable.Backend.shared.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class RedisStreamEventPublisher {

	private static final Logger log = LoggerFactory.getLogger(RedisStreamEventPublisher.class);

	private final StringRedisTemplate redisTemplate;
	private final ObjectMapper objectMapper;

	public RedisStreamEventPublisher(ObjectProvider<StringRedisTemplate> redisTemplateProvider, ObjectMapper objectMapper) {
		this.redisTemplate = redisTemplateProvider.getIfAvailable();
		this.objectMapper = objectMapper;
	}

	public RecordId publish(String streamKey, String eventType, Map<String, Object> payload) {
		if (redisTemplate == null) {
			log.warn("Redis not configured; skipping publish to stream {} eventType={}", streamKey, eventType);
			return null;
		}
		var fields = new LinkedHashMap<String, String>();
		fields.put("eventId", UUID.randomUUID().toString());
		fields.put("eventType", eventType);
		fields.put("timestamp", Instant.now().toString());

		payload.forEach((k, v) -> {
			if (v != null) {
				fields.put(k, v instanceof String ? (String) v : v.toString());
			}
		});

		RecordId recordId = redisTemplate.opsForStream().add(
				StreamRecords.string(fields).withStreamKey(streamKey)
		);

		log.debug("Published event {} to stream {} with id {}", eventType, streamKey, recordId);
		return recordId;
	}

	public RecordId publishJson(String streamKey, String eventType, Object payload) {
		if (redisTemplate == null) {
			log.warn("Redis not configured; skipping publishJson to stream {} eventType={}", streamKey, eventType);
			return null;
		}
		var fields = new LinkedHashMap<String, String>();
		fields.put("eventId", UUID.randomUUID().toString());
		fields.put("eventType", eventType);
		fields.put("timestamp", Instant.now().toString());

		try {
			fields.put("data", objectMapper.writeValueAsString(payload));
		} catch (JsonProcessingException e) {
			throw new RuntimeException("Failed to serialize event payload", e);
		}

		RecordId recordId = redisTemplate.opsForStream().add(
				StreamRecords.string(fields).withStreamKey(streamKey)
		);

		log.debug("Published JSON event {} to stream {} with id {}", eventType, streamKey, recordId);
		return recordId;
	}

	public RecordId publish(String streamKey, String eventType, String key, String value) {
		return publish(streamKey, eventType, Map.of(key, value));
	}
}
