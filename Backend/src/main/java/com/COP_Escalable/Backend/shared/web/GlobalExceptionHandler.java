package com.COP_Escalable.Backend.shared.web;

import com.COP_Escalable.Backend.shared.tenancy.TenantMissingException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(TenantMissingException.class)
	public ResponseEntity<ApiError> handleTenantMissing(TenantMissingException ex, HttpServletRequest req) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiError.of(
				"TENANT_CONTEXT_MISSING",
				ex.getMessage(),
				Map.of("path", req.getRequestURI())
		));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ApiError> handleBadRequest(IllegalArgumentException ex, HttpServletRequest req) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiError.of(
				"BAD_REQUEST",
				ex.getMessage(),
				Map.of("path", req.getRequestURI())
		));
	}
}

