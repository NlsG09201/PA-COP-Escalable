package com.COP_Escalable.Backend.aiassist.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
@EnableConfigurationProperties(AiAssistProperties.class)
public class AiAssistConfiguration {

	@Bean
	LlmCompletionClient llmCompletionClient(ObjectMapper objectMapper, AiAssistProperties props) {
		if (props.getProvider() == AiAssistProperties.Provider.STUB) {
			return new StubLlmCompletionClient(objectMapper);
		}
		return new OpenAiCompatibleCompletionClient(objectMapper, props);
	}
}
