package com.cop_escalable.j48.dto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotEmpty;
import java.util.LinkedHashMap;
import java.util.Map;

public class PredictRequest {
  @NotEmpty(message = "At least one feature is required")
  private final Map<String, Object> features = new LinkedHashMap<>();

  @JsonAnySetter
  public void putFeature(String name, Object value) {
    if ("features".equals(name) && value instanceof Map<?, ?> nested) {
      nested.forEach((key, nestedValue) -> {
        if (key != null) {
          features.put(String.valueOf(key), nestedValue);
        }
      });
      return;
    }
    features.put(name, value);
  }

  @JsonAnyGetter
  public Map<String, Object> features() {
    return features;
  }
}
