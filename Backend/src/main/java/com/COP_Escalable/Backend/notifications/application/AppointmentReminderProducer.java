package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentEventType;
import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AppointmentReminderProducer {
	private final AppointmentRepository appointmentRepository;
	private final NotificationOutboxRepository outboxRepository;
	private final NotificationPayloadSerializer payloadSerializer;
	private final NotificationProperties properties;

	public AppointmentReminderProducer(
			AppointmentRepository appointmentRepository,
			NotificationOutboxRepository outboxRepository,
			NotificationPayloadSerializer payloadSerializer,
			NotificationProperties properties
	) {
		this.appointmentRepository = appointmentRepository;
		this.outboxRepository = outboxRepository;
		this.payloadSerializer = payloadSerializer;
		this.properties = properties;
	}

	@Scheduled(fixedDelayString = "${app.notifications.reminder.poll-delay-ms:60000}")
	public void enqueueUpcomingAppointmentReminders() {
		if (!properties.reminder().enabled()) {
			return;
		}

		var now = Instant.now();
		var upperBound = now.plusSeconds(properties.reminder().leadTimeMinutes() * 60);
		var appointments = appointmentRepository.findTop100ByStatusAndStartAtBetweenOrderByStartAtAsc(
				AppointmentStatus.CONFIRMED,
				now,
				upperBound
		);

		for (var appointment : appointments) {
			if (outboxRepository.existsByAppointmentIdAndEventType(appointment.getId(), AppointmentEventType.RECORDATORIO_CITA.code())) {
				continue;
			}

			var event = AppointmentLifecycleEvent.reminder(appointment);
			outboxRepository.save(NotificationOutboxMessage.pending(event, payloadSerializer.serialize(event)));
		}
	}
}
