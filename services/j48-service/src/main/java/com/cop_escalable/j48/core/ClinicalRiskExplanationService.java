package com.cop_escalable.j48.core;

import com.cop_escalable.j48.config.J48Properties;
import com.cop_escalable.j48.dto.AiExplanationResponse;
import com.cop_escalable.j48.dto.PredictionResponse;
import com.cop_escalable.j48.exception.AiExplanationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class ClinicalRiskExplanationService {
  private static final String SYSTEM_PROMPT = """
    You are a clinical decision-support assistant for psychology relapse risk.
    Explain the J48 prediction in Spanish for a healthcare professional.
    Use only the supplied de-identified features and prediction.
    Do not invent diagnoses, do not prescribe medication, and do not ask for patient identifiers.
    Keep the answer concise with: risk summary, main factors, and next actions.
    """;

  private final J48Properties props;
  private final ObjectProvider<ChatClient.Builder> chatClientBuilder;

  public ClinicalRiskExplanationService(J48Properties props, ObjectProvider<ChatClient.Builder> chatClientBuilder) {
    this.props = props;
    this.chatClientBuilder = chatClientBuilder;
  }

  public AiExplanationResponse explain(Map<String, Object> features, PredictionResponse prediction) {
    Map<String, Object> safeInput = sanitize(features);
    if (!props.aiExplanationEnabled()) {
      return fallback(prediction, safeInput, "Spring AI explanation is disabled by configuration.");
    }

    ChatClient.Builder builder = chatClientBuilder.getIfAvailable();
    if (builder == null) {
      return fallback(prediction, safeInput, "Spring AI provider is not configured.");
    }

    try {
      String content = builder.build()
        .prompt()
        .system(SYSTEM_PROMPT)
        .user("""
          Features: %s
          Prediction: classLabel=%s, probabilities=%s
          """.formatted(safeInput, prediction.classLabel(), prediction.probabilities()))
        .call()
        .content();

      return new AiExplanationResponse(prediction, content, true, safeInput);
    } catch (Exception ex) {
      throw new AiExplanationException("Unable to generate AI explanation", ex);
    }
  }

  private AiExplanationResponse fallback(PredictionResponse prediction, Map<String, Object> safeInput, String reason) {
    String explanation = """
      Riesgo estimado: %s. La explicación generativa no está disponible: %s
      Revise las probabilidades, asistencia, bienestar, ansiedad, depresión y días desde la última atención antes de tomar decisiones clínicas.
      """.formatted(prediction.classLabel(), reason);
    return new AiExplanationResponse(prediction, explanation, false, safeInput);
  }

  private Map<String, Object> sanitize(Map<String, Object> raw) {
    Map<String, Object> safe = new LinkedHashMap<>();
    for (String key : allowedKeys()) {
      if (raw.containsKey(key)) {
        safe.put(key, raw.get(key));
      }
    }
    return safe;
  }

  private String[] allowedKeys() {
    return new String[] {
      "gender",
      "age_group",
      "sentiment",
      "wellbeing",
      "anxiety",
      "depression",
      "attendance",
      "days_since_last"
    };
  }
}
