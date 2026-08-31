package com.cop.escalable.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "cop.security")
public record CopSecurityProperties(String jwtSecret, String accessExpires) {}
