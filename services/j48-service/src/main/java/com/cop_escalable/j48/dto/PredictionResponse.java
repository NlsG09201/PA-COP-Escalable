package com.cop_escalable.j48.dto;

import java.util.Map;

public record PredictionResponse(
  String classLabel,
  double classIndex,
  Map<String, Double> probabilities
) {}
