package com.COP_Escalable.Backend.aiassist.application;

import com.fasterxml.jackson.databind.ObjectMapper;

public class StubLlmCompletionClient implements LlmCompletionClient {

	private final ObjectMapper objectMapper;

	public StubLlmCompletionClient(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public String complete(String systemPrompt, String userPrompt) {
		try {
			var out = new AiStructuredOutput();
			out.setDisclaimer("Salida simulada (STUB). No constituye evaluación clínica. Requiere revisión del profesional.");
			out.setRiskLevel("medium");
			out.setHumanReviewRequired(true);
			out.getCandidateConditions().add(stubCondition("Cuadro de ansiedad o estrés (explorar)", "Respuestas genéricas en cuestionario; confirmar en entrevista clínica.", 0.35));
			out.getCandidateConditions().add(stubCondition("Estado de ánimo bajo (explorar)", "No suficiente para conclusión; valorar PHQ/GAD u otros instrumentos.", 0.25));
			out.getSupportingSignals().add("Patrón de respuestas en cuestionario sin contexto clínico completo.");
			out.getRecommendedClarifyingQuestions().add("¿Desde cuándo nota estos síntomas y cómo afectan su día a día?");
			out.getRecommendedClarifyingQuestions().add("¿Ha tenido pensamientos de hacerse daño o de que la vida no valga la pena?");
			out.getRecommendedNonDiagnosticActions().add("Completar evaluación clínica presencial o por telemedicina con un profesional.");
			out.getEvidenceQuotesFromInput().add("Ver texto del cuestionario en el mensaje de usuario (resumen no incluido en STUB).");
			return objectMapper.writeValueAsString(out);
		} catch (Exception e) {
			throw new IllegalStateException("Stub LLM serialization failed", e);
		}
	}

	private static AiStructuredOutput.CandidateCondition stubCondition(String label, String rationale, double c) {
		var cc = new AiStructuredOutput.CandidateCondition();
		cc.setLabel(label);
		cc.setRationale(rationale);
		cc.setConfidence01(c);
		return cc;
	}
}
