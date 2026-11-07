package com.cop_escalable.j48.exception;

import com.cop_escalable.j48.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
    Map<String, String> errors = new LinkedHashMap<>();
    ex.getBindingResult().getFieldErrors().forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));
    var status = HttpStatus.BAD_REQUEST;
    return ResponseEntity.status(status).body(
      ErrorResponse.validation(status.value(), status.getReasonPhrase(), "Invalid request body", request.getRequestURI(), errors)
    );
  }

  @ExceptionHandler(InvalidPredictionRequestException.class)
  public ResponseEntity<ErrorResponse> invalidPrediction(InvalidPredictionRequestException ex, HttpServletRequest request) {
    return response(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
  }

  @ExceptionHandler(ModelNotReadyException.class)
  public ResponseEntity<ErrorResponse> modelNotReady(ModelNotReadyException ex, HttpServletRequest request) {
    return response(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), request);
  }

  @ExceptionHandler(AiExplanationException.class)
  public ResponseEntity<ErrorResponse> aiError(AiExplanationException ex, HttpServletRequest request) {
    return response(HttpStatus.BAD_GATEWAY, ex.getMessage(), request);
  }

  @ExceptionHandler(J48ModelException.class)
  public ResponseEntity<ErrorResponse> modelError(J48ModelException ex, HttpServletRequest request) {
    return response(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
    log.error("Unexpected J48 service error", ex);
    return response(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected service error", request);
  }

  private ResponseEntity<ErrorResponse> response(HttpStatus status, String message, HttpServletRequest request) {
    return ResponseEntity.status(status).body(
      ErrorResponse.of(status.value(), status.getReasonPhrase(), message, request.getRequestURI())
    );
  }
}
