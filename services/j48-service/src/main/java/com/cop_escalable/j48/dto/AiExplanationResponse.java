package com.cop_escalable.j48.dto;

import java.util.Map;

public record AiExplanationResponse(
  PredictionResponse prediction,
  String explanation,
  boolean aiGenerated,
  Map<String, Object> safeInput
) {}
