package com.COP_Escalable.Backend.aiassist.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class AiAssistAnalysisEventListener {

	private final AiAssistAsyncProcessor asyncProcessor;

	public AiAssistAnalysisEventListener(AiAssistAsyncProcessor asyncProcessor) {
		this.asyncProcessor = asyncProcessor;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onAnalysisRequested(AiAssistAnalysisRequestedEvent event) {
		asyncProcessor.processSuggestionAsync(event.suggestionId());
	}
}
