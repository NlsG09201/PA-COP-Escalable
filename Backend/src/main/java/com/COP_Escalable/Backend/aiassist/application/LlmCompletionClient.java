package com.COP_Escalable.Backend.aiassist.application;

public interface LlmCompletionClient {

	String complete(String systemPrompt, String userPrompt);
}
