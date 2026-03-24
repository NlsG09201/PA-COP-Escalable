package com.COP_Escalable.Backend.aiassist.application;

import com.COP_Escalable.Backend.psychtests.domain.TestTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Puntuación local determinística a partir de {@link TestTemplate.Question#options()} y respuestas por id de pregunta.
 * Reconoce códigos de plantilla normalizados PHQ9 / GAD7; en otro caso intenta sumar ítems puntuados.
 */
@Service
public class PsychometricLocalScoringService {

	public String buildScoringBlockForPrompt(TestTemplate template, Map<String, String> answersByQuestionId) {
		return summarize(template, answersByQuestionId).orElse("(No hay puntuación local automática para este instrumento o faltan respuestas puntuables.)");
	}

	public Optional<String> summarize(TestTemplate template, Map<String, String> answersByQuestionId) {
		if (template == null || template.getCode() == null) {
			return Optional.empty();
		}
		String norm = normalizeCode(template.getCode());
		if (norm.equals("PHQ9")) {
			return scorePhq9Like(template, answersByQuestionId, 9, "PHQ-9");
		}
		if (norm.equals("GAD7")) {
			return scorePhq9Like(template, answersByQuestionId, 7, "GAD-7");
		}
		return genericSumScoredOptions(template, answersByQuestionId);
	}

	private static Optional<String> scorePhq9Like(
			TestTemplate template,
			Map<String, String> answersByQuestionId,
			int expectedItems,
			String label
	) {
		List<String> missing = new ArrayList<>();
		int sum = 0;
		int used = 0;
		for (var q : template.getQuestions()) {
			Integer v = resolveItemScore(q, answersByQuestionId.get(q.id()));
			if (v == null) {
				missing.add(q.id());
			} else {
				sum += v;
				used++;
			}
		}
		if (used == 0) {
			return Optional.empty();
		}
		StringBuilder sb = new StringBuilder();
		sb.append(label).append(" — suma de ítems puntuados: ").append(sum);
		sb.append(" (").append(used).append("/").append(template.getQuestions().size()).append(" ítems con puntuación; esperado ~").append(expectedItems).append(" ítems)");
		if (!missing.isEmpty()) {
			sb.append(". Sin puntuar: ").append(String.join(", ", missing));
		}
		sb.append(". Esto es orientativo; la interpretación clínica la realiza el profesional.");
		return Optional.of(sb.toString());
	}

	private static Optional<String> genericSumScoredOptions(TestTemplate template, Map<String, String> answersByQuestionId) {
		int sum = 0;
		int used = 0;
		for (var q : template.getQuestions()) {
			Integer v = resolveItemScore(q, answersByQuestionId.get(q.id()));
			if (v != null) {
				sum += v;
				used++;
			}
		}
		if (used == 0) {
			return Optional.empty();
		}
		return Optional.of("Suma de ítems con opciones puntuadas: " + sum + " (" + used + "/" + template.getQuestions().size()
				+ " ítems). Heurística genérica; interpretación clínica solo por el profesional.");
	}

	private static Integer resolveItemScore(TestTemplate.Question q, String answer) {
		if (answer == null || answer.isBlank()) {
			return null;
		}
		String a = answer.trim();
		List<TestTemplate.Option> options = q.options();
		if (options != null) {
			for (var opt : options) {
				if (opt.id() != null && opt.id().equals(a)) {
					return opt.score();
				}
				if (opt.label() != null && opt.label().equalsIgnoreCase(a)) {
					return opt.score();
				}
			}
		}
		try {
			return Integer.parseInt(a);
		} catch (NumberFormatException e) {
			return null;
		}
	}

	private static String normalizeCode(String code) {
		return code.replaceAll("[^a-zA-Z0-9]", "").toUpperCase(Locale.ROOT);
	}
}
