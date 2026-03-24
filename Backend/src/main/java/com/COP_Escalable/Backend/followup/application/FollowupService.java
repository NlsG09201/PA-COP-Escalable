package com.COP_Escalable.Backend.followup.application;

import com.COP_Escalable.Backend.followup.domain.FollowupSchedule;
import com.COP_Escalable.Backend.followup.domain.FollowupSurvey;
import com.COP_Escalable.Backend.followup.domain.FollowupSurveyQuestion;
import com.COP_Escalable.Backend.followup.infrastructure.FollowupScheduleRepository;
import com.COP_Escalable.Backend.followup.infrastructure.FollowupSurveyRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FollowupService {

	private static final Logger log = LoggerFactory.getLogger(FollowupService.class);

	private static final BigDecimal RISK_THRESHOLD = new BigDecimal("3.00");

	private static final Map<String, List<String>> DENTAL_QUESTIONS = Map.of(
			"dental", List.of(
					"On a scale of 1-5, rate your current pain level",
					"Have you experienced any swelling? (1=none, 5=severe)",
					"Have you noticed any bleeding? (1=none, 5=heavy)",
					"How well have you followed your medication schedule? (1=not at all, 5=perfectly)",
					"Have you experienced any tooth sensitivity? (1=none, 5=extreme)"
			)
	);

	private static final Map<String, List<String>> PSYCHOLOGICAL_QUESTIONS = Map.of(
			"psychological", List.of(
					"Rate your overall mood today (1=very low, 5=excellent)",
					"How would you rate your sleep quality? (1=very poor, 5=excellent)",
					"Rate your anxiety level (1=extreme anxiety, 5=completely calm)",
					"How well have you adhered to prescribed medication? (1=not at all, 5=perfectly)",
					"Rate your social functioning this week (1=very isolated, 5=very engaged)"
			)
	);

	private final FollowupSurveyRepository surveyRepository;
	private final FollowupScheduleRepository scheduleRepository;
	private final FollowupProperties properties;

	public FollowupService(FollowupSurveyRepository surveyRepository,
						   FollowupScheduleRepository scheduleRepository,
						   FollowupProperties properties) {
		this.surveyRepository = surveyRepository;
		this.scheduleRepository = scheduleRepository;
		this.properties = properties;
	}

	@Transactional
	public FollowupSurvey generateSurvey(UUID patientId, String treatmentType, String triggerEvent) {
		var tenant = TenantContextHolder.require();
		Instant scheduledAt = Instant.now().plus(properties.getSurveyDelayDays(), ChronoUnit.DAYS);

		var survey = new FollowupSurvey(
				tenant.organizationId(), tenant.siteId(), patientId,
				treatmentType, triggerEvent, scheduledAt
		);

		List<String> questions = resolveQuestions(treatmentType);
		for (int i = 0; i < questions.size(); i++) {
			survey.addQuestion(questions.get(i), i);
		}

		survey.markSent();
		var saved = surveyRepository.save(survey);
		log.info("Generated followup survey {} for patient {} (type={})", saved.getId(), patientId, treatmentType);
		return saved;
	}

	@Transactional
	public FollowupSurvey completeSurvey(UUID surveyId, List<QuestionAnswer> answers) {
		var survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IllegalArgumentException("Survey not found: " + surveyId));

		Map<UUID, FollowupSurveyQuestion> questionMap = new java.util.HashMap<>();
		for (FollowupSurveyQuestion q : survey.getQuestions()) {
			questionMap.put(q.getId(), q);
		}

		BigDecimal totalScore = BigDecimal.ZERO;
		int answeredCount = 0;

		for (QuestionAnswer qa : answers) {
			FollowupSurveyQuestion question = questionMap.get(qa.questionId());
			if (question != null) {
				BigDecimal answerScore = qa.score() != null ? qa.score() : parseScoreFromAnswer(qa.answer());
				question.recordAnswer(qa.answer(), answerScore);
				totalScore = totalScore.add(answerScore);
				answeredCount++;
			}
		}

		BigDecimal avgScore = answeredCount > 0
				? totalScore.divide(BigDecimal.valueOf(answeredCount), 2, RoundingMode.HALF_UP)
				: BigDecimal.ZERO;

		boolean risk = detectRisks(survey, avgScore);
		survey.markCompleted(avgScore, risk);

		var saved = surveyRepository.save(survey);
		log.info("Completed survey {} with avg score {} (risk={})", surveyId, avgScore, risk);
		return saved;
	}

	@Transactional
	public List<FollowupSchedule> scheduleControlAppointments(UUID patientId, String treatmentType) {
		var tenant = TenantContextHolder.require();
		LocalDate today = LocalDate.now();

		List<FollowupSchedule> schedules = properties.getControlAppointmentDays().stream()
				.map(days -> {
					LocalDate date = today.plusDays(days);
					String reason = String.format("Control de seguimiento %s - día %d post-tratamiento", treatmentType, days);
					return new FollowupSchedule(
							tenant.organizationId(), tenant.siteId(), patientId,
							reason, date
					);
				})
				.toList();

		var saved = scheduleRepository.saveAll(schedules);
		log.info("Scheduled {} control appointments for patient {}", saved.size(), patientId);
		return saved;
	}

	@Transactional(readOnly = true)
	public List<FollowupSurvey> getPatientSurveys(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return surveyRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	@Transactional(readOnly = true)
	public List<FollowupSurvey> getPendingSurveys() {
		return surveyRepository.findByStatusAndScheduledAtBefore("SENT", Instant.now());
	}

	@Transactional(readOnly = true)
	public List<FollowupSchedule> getPatientSchedules(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return scheduleRepository.findByOrganizationIdAndSiteIdAndPatientId(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	boolean detectRisks(FollowupSurvey survey, BigDecimal avgScore) {
		if (avgScore.compareTo(RISK_THRESHOLD) < 0) {
			return true;
		}

		for (FollowupSurveyQuestion q : survey.getQuestions()) {
			if (q.getScore() != null && q.getScore().compareTo(BigDecimal.ONE) <= 0) {
				return true;
			}
			if (q.getAnswer() != null) {
				String lower = q.getAnswer().toLowerCase();
				if (lower.contains("severe") || lower.contains("extreme") || lower.contains("emergency")
						|| lower.contains("blood") || lower.contains("suicid") || lower.contains("crisis")) {
					return true;
				}
			}
		}
		return false;
	}

	private List<String> resolveQuestions(String treatmentType) {
		if (treatmentType != null && treatmentType.toLowerCase().contains("psych")) {
			return PSYCHOLOGICAL_QUESTIONS.get("psychological");
		}
		return DENTAL_QUESTIONS.get("dental");
	}

	private BigDecimal parseScoreFromAnswer(String answer) {
		if (answer == null || answer.isBlank()) {
			return BigDecimal.ZERO;
		}
		try {
			return new BigDecimal(answer.trim());
		} catch (NumberFormatException e) {
			return BigDecimal.valueOf(3);
		}
	}
}
