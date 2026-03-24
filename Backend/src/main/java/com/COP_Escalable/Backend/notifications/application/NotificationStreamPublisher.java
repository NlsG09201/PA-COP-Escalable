package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;

@Service
public class NotificationStreamPublisher {
	private final StringRedisTemplate redisTemplate;
	private final NotificationProperties properties;

	public NotificationStreamPublisher(
			StringRedisTemplate redisTemplate,
			NotificationProperties properties
	) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
	}

	public RecordId publish(NotificationOutboxMessage outboxMessage, String purpose) {
		var payload = new LinkedHashMap<String, String>();
		payload.put("outboxMessageId", outboxMessage.getId().toString());
		if (outboxMessage.getAppointmentId() != null) {
			payload.put("appointmentId", outboxMessage.getAppointmentId().toString());
		}
		payload.put("patientId", outboxMessage.getPatientId().toString());
		payload.put("eventType", outboxMessage.getEventType());
		payload.put("purpose", purpose);
		return redisTemplate.opsForStream().add(
				StreamRecords.string(payload).withStreamKey(properties.redis().stream())
		);
	}
}
