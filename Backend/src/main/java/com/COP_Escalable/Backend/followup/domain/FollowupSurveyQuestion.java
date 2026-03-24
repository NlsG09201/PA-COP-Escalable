package com.COP_Escalable.Backend.followup.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "followup_survey_questions")
public class FollowupSurveyQuestion {

	@Id
	@GeneratedValue
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "survey_id", nullable = false)
	private FollowupSurvey survey;

	@Column(name = "question", nullable = false, columnDefinition = "TEXT")
	private String question;

	@Column(name = "answer", columnDefinition = "TEXT")
	private String answer;

	@Column(name = "score", precision = 5, scale = 2)
	private BigDecimal score;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	protected FollowupSurveyQuestion() {}

	public FollowupSurveyQuestion(FollowupSurvey survey, String question, int sortOrder) {
		this.survey = survey;
		this.question = question;
		this.sortOrder = sortOrder;
	}

	public void recordAnswer(String answer, BigDecimal score) {
		this.answer = answer;
		this.score = score;
	}

	public UUID getId() { return id; }
	public FollowupSurvey getSurvey() { return survey; }
	public String getQuestion() { return question; }
	public String getAnswer() { return answer; }
	public BigDecimal getScore() { return score; }
	public int getSortOrder() { return sortOrder; }
}
