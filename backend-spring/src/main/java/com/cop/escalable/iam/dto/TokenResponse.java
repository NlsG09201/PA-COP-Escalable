package com.cop.escalable.iam.dto;
import java.util.List;
public record TokenResponse(String accessToken, String refreshToken, User user) { public record User(String id, String username, List<String> roles) {} }
