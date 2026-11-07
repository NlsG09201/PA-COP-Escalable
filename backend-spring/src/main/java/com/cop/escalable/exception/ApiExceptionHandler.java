package com.cop.escalable.exception;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> invalid(MethodArgumentNotValidException ex) { return response(HttpStatus.BAD_REQUEST, "Validation failed"); }
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException ex) { return response(HttpStatus.BAD_REQUEST, ex.getMessage()); }
  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<Map<String, Object>> forbidden(AccessDeniedException ex) { return response(HttpStatus.FORBIDDEN, "Forbidden"); }
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, Object>> status(ResponseStatusException ex) { return response(HttpStatus.valueOf(ex.getStatusCode().value()), ex.getReason() == null ? "Request failed" : ex.getReason()); }
  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> generic(Exception ex) { return response(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error"); }
  private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
    return ResponseEntity.status(status).body(Map.of("statusCode", status.value(), "message", message, "timestamp", Instant.now().toString()));
  }
}
