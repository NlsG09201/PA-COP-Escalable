package com.COP_Escalable.Backend.aiassist.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AiAssistAsyncProcessor {

	private static final Logger log = LoggerFactory.getLogger(AiAssistAsyncProcessor.class);

	private final AiAssistService aiAssistService;

	public AiAssistAsyncProcessor(AiAssistService aiAssistService) {
		this.aiAssistService = aiAssistService;
	}

	@Async
	public void processSuggestionAsync(UUID suggestionId) {
		try {
			aiAssistService.processQueuedPsychTestAnalysis(suggestionId);
		} catch (Exception e) {
			log.error("Async AI assist failed for suggestion {}", suggestionId, e);
		}
	}
}
