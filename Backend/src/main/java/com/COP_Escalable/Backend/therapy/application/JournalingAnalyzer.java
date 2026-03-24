package com.COP_Escalable.Backend.therapy.application;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Component
public class JournalingAnalyzer {

	private static final Set<String> POSITIVE_WORDS = Set.of(
			"happy", "grateful", "joy", "love", "hope", "peace", "calm", "confident",
			"proud", "excited", "motivated", "strong", "relaxed", "content", "blessed",
			"feliz", "gratitud", "alegría", "amor", "esperanza", "paz", "calma",
			"orgulloso", "motivado", "fuerte", "tranquilo", "contento", "bendecido",
			"bien", "mejor", "excelente", "genial", "maravilloso", "increíble"
	);

	private static final Set<String> NEGATIVE_WORDS = Set.of(
			"sad", "angry", "fear", "anxiety", "stress", "worried", "depressed", "lonely",
			"hopeless", "tired", "frustrated", "pain", "scared", "guilty", "shame",
			"triste", "enojado", "miedo", "ansiedad", "estrés", "preocupado", "deprimido",
			"solo", "desesperanza", "cansado", "frustrado", "dolor", "asustado", "culpa",
			"vergüenza", "mal", "peor", "terrible", "horrible", "angustia"
	);

	private static final Map<String, Set<String>> THEME_KEYWORDS = Map.of(
			"relationships", Set.of("family", "friend", "partner", "love", "conflict", "together",
					"familia", "amigo", "pareja", "juntos", "relación"),
			"work", Set.of("work", "job", "boss", "career", "office", "deadline",
					"trabajo", "jefe", "carrera", "oficina", "proyecto"),
			"health", Set.of("health", "body", "sleep", "exercise", "medication", "doctor",
					"salud", "cuerpo", "sueño", "ejercicio", "medicamento", "médico"),
			"self-growth", Set.of("learn", "grow", "improve", "goal", "progress", "change",
					"aprender", "crecer", "mejorar", "meta", "progreso", "cambio"),
			"emotions", Set.of("feel", "emotion", "mood", "cry", "laugh", "overwhelm",
					"sentir", "emoción", "ánimo", "llorar", "reír", "abrumado")
	);

	public Map<String, Object> analyzeEntry(String text) {
		if (text == null || text.isBlank()) {
			return Map.of(
					"sentiment", "neutral",
					"sentimentScore", BigDecimal.ZERO,
					"wordCount", 0,
					"themes", List.of()
			);
		}

		String[] words = text.toLowerCase().split("[\\s,.;:!?()\\[\\]\"']+");
		int wordCount = words.length;

		int positiveCount = 0;
		int negativeCount = 0;

		for (String word : words) {
			if (POSITIVE_WORDS.contains(word)) positiveCount++;
			if (NEGATIVE_WORDS.contains(word)) negativeCount++;
		}

		int totalSentimentWords = positiveCount + negativeCount;
		BigDecimal sentimentScore;
		String sentiment;

		if (totalSentimentWords == 0) {
			sentimentScore = BigDecimal.ZERO;
			sentiment = "neutral";
		} else {
			sentimentScore = BigDecimal.valueOf(positiveCount - negativeCount)
					.divide(BigDecimal.valueOf(totalSentimentWords), 4, RoundingMode.HALF_UP);

			if (sentimentScore.compareTo(new BigDecimal("0.2")) > 0) {
				sentiment = "positive";
			} else if (sentimentScore.compareTo(new BigDecimal("-0.2")) < 0) {
				sentiment = "negative";
			} else if (positiveCount > 0 && negativeCount > 0) {
				sentiment = "mixed";
			} else {
				sentiment = "neutral";
			}
		}

		Set<String> wordSet = Set.of(words);
		List<String> detectedThemes = new ArrayList<>();
		for (Map.Entry<String, Set<String>> entry : THEME_KEYWORDS.entrySet()) {
			for (String keyword : entry.getValue()) {
				if (wordSet.contains(keyword)) {
					detectedThemes.add(entry.getKey());
					break;
				}
			}
		}

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("sentiment", sentiment);
		result.put("sentimentScore", sentimentScore);
		result.put("wordCount", wordCount);
		result.put("positiveWords", positiveCount);
		result.put("negativeWords", negativeCount);
		result.put("themes", detectedThemes);
		return result;
	}
}
