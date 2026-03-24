package com.COP_Escalable.Backend.aiassist.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class AiAssistAnalysisEventListener {

	private static final Logger log = LoggerFactory.getLogger(AiAssistAnalysisEventListener.class);

	private final AiAssistProperties props;
	private final AiAssistAsyncProcessor asyncProcessor;
	private final ObjectProvider<AiAssistStreamPublisher> streamPublisher;

	public AiAssistAnalysisEventListener(
			AiAssistProperties props,
			AiAssistAsyncProcessor asyncProcessor,
			ObjectProvider<AiAssistStreamPublisher> streamPublisher
	) {
		this.props = props;
		this.asyncProcessor = asyncProcessor;
		this.streamPublisher = streamPublisher;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onAnalysisRequested(AiAssistAnalysisRequestedEvent event) {
		if (!props.isAsync()) {
			return;
		}
		var id = event.suggestionId();
		var publisher = streamPublisher.getIfAvailable();
		if (props.getRedisStream().isEnabled() && publisher != null) {
			try {
				publisher.publishSuggestionQueued(id);
				return;
			} catch (RuntimeException ex) {
				log.warn("AI assist: no se pudo publicar en Redis Stream ({}); se usa async en memoria", ex.getMessage());
			}
		}
		asyncProcessor.processSuggestionAsync(id);
	}
}
