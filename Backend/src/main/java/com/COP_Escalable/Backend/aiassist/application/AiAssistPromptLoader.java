package com.COP_Escalable.Backend.aiassist.application;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;

@Component
public class AiAssistPromptLoader {

	private final AiAssistProperties props;

	public AiAssistPromptLoader(AiAssistProperties props) {
		this.props = props;
	}

	public String loadSystemPrompt() {
		String version = props.getPromptVersion() == null ? "v1" : props.getPromptVersion().trim();
		return readClasspath("ai-assist/prompts/" + version + "-system.txt");
	}

	public String loadUserTemplate() {
		String version = props.getPromptVersion() == null ? "v1" : props.getPromptVersion().trim();
		return readClasspath("ai-assist/prompts/" + version + "-user.txt");
	}

	private static String readClasspath(String path) {
		try {
			var res = new ClassPathResource(path);
			if (!res.exists()) {
				throw new IllegalStateException("Missing classpath resource: " + path);
			}
			return StreamUtils.copyToString(res.getInputStream(), StandardCharsets.UTF_8).trim();
		} catch (Exception e) {
			throw new IllegalStateException("Failed to load prompt: " + path, e);
		}
	}
}
