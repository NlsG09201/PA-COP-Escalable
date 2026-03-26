package com.COP_Escalable.Backend.shared.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class WebMvcConfig {

	@Bean
	CorsConfigurationSource corsConfigurationSource(
			@Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:5174,http://localhost:3000}") String allowedOrigins,
			@Value("${app.cors.allowed-headers:Authorization,Content-Type,Accept,X-Requested-With,If-None-Match,If-Match}") String allowedHeaders
	) {
		List<String> origins = Arrays.asList(allowedOrigins.split(",\\s*"));
		var config = new CorsConfiguration();
		config.setAllowedOrigins(origins);
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(Arrays.asList(allowedHeaders.split(",\\s*")));
		config.setMaxAge(3600L);
		config.setExposedHeaders(List.of("Authorization"));
		var source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}
}
