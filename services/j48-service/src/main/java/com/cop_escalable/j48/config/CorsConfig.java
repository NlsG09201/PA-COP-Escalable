package com.cop_escalable.j48.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {
  private final J48Properties props;

  public CorsConfig(J48Properties props) {
    this.props = props;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    var source = new UrlBasedCorsConfigurationSource();
    String raw = props.corsAllowedOrigins() == null ? "" : props.corsAllowedOrigins().trim();
    if (raw.isEmpty()) {
      source.registerCorsConfiguration("/**", new CorsConfiguration());
      return source;
    }

    List<String> origins = Arrays.stream(raw.split(","))
      .map(String::trim)
      .filter(origin -> !origin.isEmpty())
      .toList();
    if (origins.isEmpty()) {
      source.registerCorsConfiguration("/**", new CorsConfiguration());
      return source;
    }

    var config = new CorsConfiguration();
    config.setAllowedOrigins(origins);
    config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
    config.setAllowedHeaders(List.of("Content-Type", "Accept", "X-J48-Admin-Token"));
    config.setMaxAge(3600L);
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
