package com.cop_escalable.j48.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.cop_escalable.j48.config.J48Properties;
import com.cop_escalable.j48.dto.AiExplanationResponse;
import com.cop_escalable.j48.dto.PredictionResponse;
import java.util.Iterator;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;

class ClinicalRiskExplanationServiceTest {
  @Test
  void returnsFallbackWhenAiExplanationIsDisabled() {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        false,
        "http://localhost:4200"
    );
    ObjectProvider<ChatClient.Builder> builderProvider = objectProvider(null);
    Environment environment = new MockEnvironment();

    ClinicalRiskExplanationService service = new ClinicalRiskExplanationService(props, builderProvider, environment);
    PredictionResponse prediction = new PredictionResponse("HIGH", 0.8, Map.of("HIGH", 0.82));

    AiExplanationResponse response = service.explain(Map.of("gender", "M", "age_group", "ADULT"), prediction);

    assertThat(response.aiGenerated()).isFalse();
    assertThat(response.explanation()).contains("Spring AI explanation is disabled by configuration");
  }

  @Test
  void returnsFallbackWhenAiProviderIsNotConfigured() {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    ObjectProvider<ChatClient.Builder> builderProvider = objectProvider(null);
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("spring.ai.openai.chat.enabled", "false");
    environment.setProperty("spring.ai.openai.api-key", "test-key");

    ClinicalRiskExplanationService service = new ClinicalRiskExplanationService(props, builderProvider, environment);
    PredictionResponse prediction = new PredictionResponse("LOW", 0.2, Map.of("LOW", 0.71));

    AiExplanationResponse response = service.explain(Map.of("gender", "F", "wellbeing", "HIGH"), prediction);

    assertThat(response.aiGenerated()).isFalse();
    assertThat(response.explanation()).contains("not configured or disabled");
  }

  @Test
  void sanitizesInputWhenAiIsEnabledButNoProviderExists() {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    ObjectProvider<ChatClient.Builder> builderProvider = objectProvider(null);
    MockEnvironment environment = new MockEnvironment();
    environment.setProperty("spring.ai.openai.chat.enabled", "true");
    environment.setProperty("spring.ai.openai.api-key", "dummy-placeholder-key");

    ClinicalRiskExplanationService service = new ClinicalRiskExplanationService(props, builderProvider, environment);
    PredictionResponse prediction = new PredictionResponse("MEDIUM", 0.5, Map.of("MEDIUM", 0.49));
    Map<String, Object> features = Map.of(
        "gender", "F",
        "age_group", "ADULT",
        "sentiment", "NEGATIVE",
        "wellbeing", "MEDIUM",
        "patientName", "must-not-leak"
    );

    AiExplanationResponse response = service.explain(features, prediction);

    assertThat(response.aiGenerated()).isFalse();
    assertThat(response.safeInput()).doesNotContainKey("patientName");
    assertThat(response.safeInput()).containsOnlyKeys("gender", "age_group", "sentiment", "wellbeing");
  }

  private static ObjectProvider<ChatClient.Builder> objectProvider(ChatClient.Builder builder) {
    return new ObjectProvider<>() {
      @Override
      public ChatClient.Builder getObject() {
        return builder;
      }

      @Override
      public ChatClient.Builder getObject(Object... args) {
        return builder;
      }

      @Override
      public ChatClient.Builder getIfAvailable() {
        return builder;
      }

      @Override
      public ChatClient.Builder getIfAvailable(Supplier<ChatClient.Builder> defaultSupplier) {
        return builder != null ? builder : defaultSupplier.get();
      }

      @Override
      public ChatClient.Builder getIfUnique() {
        return builder;
      }

      @Override
      public ChatClient.Builder getIfUnique(Supplier<ChatClient.Builder> defaultSupplier) {
        return builder != null ? builder : defaultSupplier.get();
      }

      @Override
      public Stream<ChatClient.Builder> stream() {
        return builder == null ? Stream.empty() : Stream.of(builder);
      }

      @Override
      public Stream<ChatClient.Builder> orderedStream() {
        return stream();
      }

      @Override
      public Iterator<ChatClient.Builder> iterator() {
        return stream().iterator();
      }
    };
  }

}
