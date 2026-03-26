package com.COP_Escalable.Backend.iam.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Sliding-window style rate limiting (per minute) for authentication endpoints using Redis INCR + TTL.
 */
@Component
public class RedisAuthenticationRateLimiter {

	private static final Logger log = LoggerFactory.getLogger(RedisAuthenticationRateLimiter.class);
	private static final Duration WINDOW = Duration.ofMinutes(1);

	private final StringRedisTemplate redis;

	public RedisAuthenticationRateLimiter(StringRedisTemplate redis) {
		this.redis = redis;
	}

	/**
	 * @return true if request is allowed, false if rate limit exceeded
	 */
	public boolean allow(String bucket, String key, int maxPerMinute) {
		if (maxPerMinute <= 0) {
			return true;
		}
		String redisKey = "security:rl:" + bucket + ":" + key;
		try {
			Long n = redis.opsForValue().increment(redisKey);
			if (n != null && n == 1L) {
				redis.expire(redisKey, WINDOW);
			}
			return n != null && n <= maxPerMinute;
		} catch (Exception e) {
			log.warn("Rate limiter degraded (Redis unavailable) — allowing request: {}", e.toString());
			return true;
		}
	}
}
