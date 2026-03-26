package com.COP_Escalable.Backend.followup.domain;

import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Embedded question/answer inside {@link FollowupSurvey}.
 */
public class FollowupSurveyQuestion {

	private UUID id;

	private String question;

	private String answer;

	private BigDecimal score;

	@Field("sort_order")
	private int sortOrder;

	protected FollowupSurveyQuestion() {}

	public FollowupSurveyQuestion(String question, int sortOrder) {
		this.question = question;
		this.sortOrder = sortOrder;
	}

	public void ensureId() {
		if (id == null) {
			id = UUID.randomUUID();
		}
	}

	public void recordAnswer(String answer, BigDecimal score) {
		this.answer = answer;
		this.score = score;
	}

	public UUID getId() {
		return id;
	}

	public String getQuestion() {
		return question;
	}

	public String getAnswer() {
		return answer;
	}

	public BigDecimal getScore() {
		return score;
	}

	public int getSortOrder() {
		return sortOrder;
	}
}
