package com.cop_escalable.j48.dto;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
  Instant timestamp,
  int status,
  String error,
  String message,
  String path,
  Map<String, String> validationErrors
) {
  public static ErrorResponse of(int status, String error, String message, String path) {
    return new ErrorResponse(Instant.now(), status, error, message, path, Map.of());
  }

  public static ErrorResponse validation(int status, String error, String message, String path, Map<String, String> errors) {
    return new ErrorResponse(Instant.now(), status, error, message, path, errors);
  }
}
