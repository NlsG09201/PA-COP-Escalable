package com.cop_escalable.j48.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
  @Bean
  OpenAPI j48OpenApi() {
    return new OpenAPI()
      .info(new Info()
        .title("COP J48 Spring Boot Service")
        .version("1.0.0")
        .description("J48 relapse-risk prediction service with optional Spring AI explanation."))
      .components(new Components().addSecuritySchemes(
        "j48AdminToken",
        new SecurityScheme()
          .type(SecurityScheme.Type.APIKEY)
          .in(SecurityScheme.In.HEADER)
          .name("X-J48-Admin-Token")
      ));
  }
}
