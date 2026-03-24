package com.COP_Escalable.Backend.notifications.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class NotificationPayloadSerializer {
	private final ObjectMapper objectMapper;

	public NotificationPayloadSerializer(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public String serialize(Object payload) {
		try {
			return objectMapper.writeValueAsString(payload);
		} catch (JsonProcessingException ex) {
			throw new IllegalStateException("Unable to serialize notification payload", ex);
		}
	}
}
