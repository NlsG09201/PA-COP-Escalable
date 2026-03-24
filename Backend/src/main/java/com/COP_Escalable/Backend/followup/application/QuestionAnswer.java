package com.COP_Escalable.Backend.followup.application;

import java.math.BigDecimal;
import java.util.UUID;

public record QuestionAnswer(UUID questionId, String answer, BigDecimal score) {
}
