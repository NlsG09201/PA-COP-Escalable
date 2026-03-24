package com.COP_Escalable.Backend.followup.application;

import com.COP_Escalable.Backend.appointments.application.AppointmentEventType;
import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.shared.infrastructure.RedisStreamEventPublisher;
import com.COP_Escalable.Backend.shared.infrastructure.StreamEventTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class FollowupEventListener {

	private static final Logger log = LoggerFactory.getLogger(FollowupEventListener.class);

	private final FollowupService followupService;
	private final FollowupProperties properties;
	private final RedisStreamEventPublisher redisPublisher;

	public FollowupEventListener(FollowupService followupService,
								 FollowupProperties properties,
								 RedisStreamEventPublisher redisPublisher) {
		this.followupService = followupService;
		this.properties = properties;
		this.redisPublisher = redisPublisher;
	}

	@Async
	@EventListener
	public void onAppointmentCompleted(AppointmentLifecycleEvent event) {
		if (!properties.isEnabled()) {
			return;
		}
		if (event.eventType() != AppointmentEventType.CITA_CONFIRMADA) {
			return;
		}

		try {
			String treatmentType = inferTreatmentType(event.reason());

			var survey = followupService.generateSurvey(
					event.patientId(), treatmentType, "APPOINTMENT_COMPLETED"
			);

			followupService.scheduleControlAppointments(event.patientId(), treatmentType);

			redisPublisher.publish(
					StreamEventTypes.FOLLOWUP_EVENTS,
					"FOLLOWUP_GENERATED",
					Map.of(
							"patientId", event.patientId().toString(),
							"surveyId", survey.getId().toString(),
							"appointmentId", event.appointmentId().toString(),
							"treatmentType", treatmentType
					)
			);

			log.info("Followup generated for appointment {} patient {}", event.appointmentId(), event.patientId());
		} catch (Exception e) {
			log.error("Error generating followup for appointment {}: {}", event.appointmentId(), e.getMessage(), e);
		}
	}

	private String inferTreatmentType(String reason) {
		if (reason == null) return "dental";
		String lower = reason.toLowerCase();
		if (lower.contains("psic") || lower.contains("psych") || lower.contains("terapia")
				|| lower.contains("therapy") || lower.contains("counseling")) {
			return "psychological";
		}
		return "dental";
	}
}
