package com.cop_escalable.j48.dto;

public record TrainingResponse(
  boolean ok,
  int trainedOn,
  int attributes,
  String classAttribute,
  String modelPath
) {}
