package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.clinical.application.MedicalAlertNotificationEvent;
import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class NotificationOutboxListener {
	private final NotificationOutboxRepository outboxRepository;
	private final NotificationPayloadSerializer payloadSerializer;

	public NotificationOutboxListener(
			NotificationOutboxRepository outboxRepository,
			NotificationPayloadSerializer payloadSerializer
	) {
		this.outboxRepository = outboxRepository;
		this.payloadSerializer = payloadSerializer;
	}

	@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
	public void onAppointmentLifecycle(AppointmentLifecycleEvent event) {
		outboxRepository.save(NotificationOutboxMessage.pending(event, payloadSerializer.serialize(event)));
	}

	@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
	public void onMedicalAlert(MedicalAlertNotificationEvent event) {
		outboxRepository.save(NotificationOutboxMessage.pending(event, payloadSerializer.serialize(event)));
	}
}
