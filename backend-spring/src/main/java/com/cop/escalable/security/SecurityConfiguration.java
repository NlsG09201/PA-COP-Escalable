package com.cop.escalable.security;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration @EnableWebSecurity @org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfiguration {
  @Bean SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwt) throws Exception {
    return http.csrf(csrf -> csrf.disable()).cors(c -> {}).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .exceptionHandling(e -> e.authenticationEntryPoint((request, response, exception) -> { response.setStatus(401); response.setContentType("application/json"); response.getWriter().write("{\"statusCode\":401,\"message\":\"Unauthorized\"}"); }).accessDeniedHandler((request, response, exception) -> { response.setStatus(403); response.setContentType("application/json"); response.getWriter().write("{\"statusCode\":403,\"message\":\"Forbidden\"}"); }))
      .authorizeHttpRequests(a -> a.requestMatchers("/health", "/health/**", "/actuator/health", "/api/docs/**", "/v3/api-docs/**", "/api/auth/login", "/api/auth/refresh").permitAll().requestMatchers(HttpMethod.OPTIONS, "/**").permitAll().anyRequest().authenticated())
      .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class).build();
  }
  @Bean CorsConfigurationSource corsConfigurationSource(List<String> corsOrigins) {
    CorsConfiguration c = new CorsConfiguration(); c.setAllowedOrigins(corsOrigins); c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS")); c.setAllowedHeaders(List.of("Authorization","Content-Type","Accept")); c.setExposedHeaders(List.of("Authorization"));
    var source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**", c); return source;
  }
}
