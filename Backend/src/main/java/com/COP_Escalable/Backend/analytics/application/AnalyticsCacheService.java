package com.COP_Escalable.Backend.analytics.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
public class AnalyticsCacheService {
	private static final Logger log = LoggerFactory.getLogger(AnalyticsCacheService.class);

	private final StringRedisTemplate redis;
	private final ObjectMapper objectMapper;
	private final AnalyticsProperties properties;

	public AnalyticsCacheService(StringRedisTemplate redis, ObjectMapper objectMapper, AnalyticsProperties properties) {
		this.redis = redis;
		this.objectMapper = objectMapper;
		this.properties = properties;
	}

	public <T> Optional<T> get(String key, Class<T> type) {
		if (properties.cacheTtlSeconds() == 0) {
			return Optional.empty();
		}
		try {
			var json = redis.opsForValue().get(key);
			if (json == null || json.isBlank()) {
				return Optional.empty();
			}
			return Optional.of(objectMapper.readValue(json, type));
		} catch (Exception ex) {
			log.warn("Analytics cache read failed for key {}: {}", key, ex.getMessage());
			return Optional.empty();
		}
	}

	public void put(String key, Object value) {
		if (properties.cacheTtlSeconds() == 0) {
			return;
		}
		try {
			var json = objectMapper.writeValueAsString(value);
			redis.opsForValue().set(key, json, Duration.ofSeconds(properties.cacheTtlSeconds()));
		} catch (JsonProcessingException ex) {
			log.warn("Analytics cache write failed for key {}: {}", key, ex.getMessage());
		} catch (Exception ex) {
			log.warn("Analytics cache write failed for key {}: {}", key, ex.getMessage());
		}
	}

	public static String overviewKey(String namespace, String suffix) {
		return "analytics:v1:" + namespace + ":" + suffix;
	}
}
