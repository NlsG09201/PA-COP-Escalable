package com.COP_Escalable.Backend.aiassist.application;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.UUID;

@Service
@ConditionalOnBean(StringRedisTemplate.class)
public class AiAssistStreamPublisher {

	private final StringRedisTemplate redisTemplate;
	private final AiAssistProperties properties;

	public AiAssistStreamPublisher(StringRedisTemplate redisTemplate, AiAssistProperties properties) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
	}

	public RecordId publishSuggestionQueued(UUID suggestionId) {
		var rs = properties.getRedisStream();
		var payload = new LinkedHashMap<String, String>();
		payload.put("suggestionId", suggestionId.toString());
		payload.put("type", "psych_test_analysis");
		return redisTemplate.opsForStream().add(
				StreamRecords.string(payload).withStreamKey(rs.getStreamKey())
		);
	}
}
