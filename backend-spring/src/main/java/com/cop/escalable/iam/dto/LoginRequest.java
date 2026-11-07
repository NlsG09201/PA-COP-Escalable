package com.cop.escalable.iam.dto;
import jakarta.validation.constraints.NotBlank;
public record LoginRequest(@NotBlank String username, @NotBlank String password, String siteId) {}
