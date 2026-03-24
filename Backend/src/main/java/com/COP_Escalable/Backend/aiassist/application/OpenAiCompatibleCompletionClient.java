package com.COP_Escalable.Backend.aiassist.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

public class OpenAiCompatibleCompletionClient implements LlmCompletionClient {

	private final ObjectMapper objectMapper;
	private final AiAssistProperties props;
	private final HttpClient httpClient;

	public OpenAiCompatibleCompletionClient(ObjectMapper objectMapper, AiAssistProperties props) {
		this.objectMapper = objectMapper;
		this.props = props;
		this.httpClient = HttpClient.newBuilder()
				.connectTimeout(props.getHttpTimeout())
				.build();
	}

	@Override
	public String complete(String systemPrompt, String userPrompt) {
		String key = props.getApiKey();
		if (key == null || key.isBlank()) {
			throw new IllegalStateException("app.ai-assist.api-key is required when provider is OPENAI_COMPAT");
		}
		String base = normalizeBase(props.getBaseUrl());
		URI uri = URI.create(base + "/v1/chat/completions");

		ObjectNode body = objectMapper.createObjectNode();
		body.put("model", props.getModel());
		body.put("temperature", 0.2);
		ArrayNode messages = body.putArray("messages");
		ObjectNode sys = messages.addObject();
		sys.put("role", "system");
		sys.put("content", systemPrompt);
		ObjectNode user = messages.addObject();
		user.put("role", "user");
		user.put("content", userPrompt);

		String payload;
		try {
			payload = objectMapper.writeValueAsString(body);
		} catch (Exception e) {
			throw new IllegalStateException("LLM request serialization failed", e);
		}

		HttpRequest request = HttpRequest.newBuilder(uri)
				.timeout(props.getHttpTimeout())
				.header("Authorization", "Bearer " + key.trim())
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
				.build();

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				throw new IllegalStateException("LLM HTTP " + response.statusCode() + ": " + truncate(response.body(), 500));
			}
			JsonNode root = objectMapper.readTree(response.body());
			JsonNode choices = root.path("choices");
			if (!choices.isArray() || choices.isEmpty()) {
				throw new IllegalStateException("LLM response missing choices");
			}
			String content = choices.get(0).path("message").path("content").asText(null);
			if (content == null || content.isBlank()) {
				throw new IllegalStateException("LLM response missing message content");
			}
			return content;
		} catch (IllegalStateException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("LLM request failed", e);
		}
	}

	private static String normalizeBase(String baseUrl) {
		if (baseUrl == null || baseUrl.isBlank()) {
			return "https://api.openai.com";
		}
		String b = baseUrl.trim();
		while (b.endsWith("/")) {
			b = b.substring(0, b.length() - 1);
		}
		return b;
	}

	private static String truncate(String s, int max) {
		if (s == null) {
			return "";
		}
		return s.length() <= max ? s : s.substring(0, max) + "...";
	}
}
