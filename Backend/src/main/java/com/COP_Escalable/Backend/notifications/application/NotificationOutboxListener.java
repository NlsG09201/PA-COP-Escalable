package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class NotificationOutboxListener {
	private final NotificationOutboxRepository outboxRepository;
	private final ObjectMapper objectMapper;

	public NotificationOutboxListener(
			NotificationOutboxRepository outboxRepository,
			ObjectMapper objectMapper
	) {
		this.outboxRepository = outboxRepository;
		this.objectMapper = objectMapper;
	}

	@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
	public void onAppointmentLifecycle(AppointmentLifecycleEvent event) {
		outboxRepository.save(NotificationOutboxMessage.pending(event, serialize(event)));
	}

	private String serialize(AppointmentLifecycleEvent event) {
		try {
			return objectMapper.writeValueAsString(event);
		} catch (JsonProcessingException ex) {
			throw new IllegalStateException("Unable to serialize appointment lifecycle event", ex);
		}
	}
}
