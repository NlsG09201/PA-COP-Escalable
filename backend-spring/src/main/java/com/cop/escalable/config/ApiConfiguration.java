package com.cop.escalable.config;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableConfigurationProperties(CopSecurityProperties.class)
public class ApiConfiguration {
  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
  @Bean Duration accessTokenTtl(CopSecurityProperties properties) {
    String value = properties.accessExpires() == null ? "45m" : properties.accessExpires().trim();
    if (value.matches("\\d+[mM]")) return Duration.ofMinutes(Long.parseLong(value.substring(0, value.length() - 1)));
    if (value.matches("\\d+[hH]")) return Duration.ofHours(Long.parseLong(value.substring(0, value.length() - 1)));
    throw new IllegalStateException("JWT_ACCESS_EXPIRES must use a minutes or hours suffix");
  }
  @Bean List<String> corsOrigins(org.springframework.core.env.Environment env) {
    return Arrays.stream(env.getProperty("cop.cors.allowed-origins", "").split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
  }
}
