package com.COP_Escalable.Backend.copilot.application;

import com.COP_Escalable.Backend.copilot.domain.CopilotSession;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class SessionSummaryGenerator {

	public String generateSummary(CopilotSession session, List<String> suggestions) {
		var sb = new StringBuilder();

		sb.append("=== CLINICAL SESSION SUMMARY ===\n\n");

		sb.append("Session Type: ").append(session.getSessionType()).append('\n');
		sb.append("Started: ").append(session.getStartedAt()).append('\n');
		if (session.getEndedAt() != null) {
			Duration duration = Duration.between(session.getStartedAt(), session.getEndedAt());
			sb.append("Duration: ").append(duration.toMinutes()).append(" minutes\n");
		}
		sb.append('\n');

		sb.append("--- Chief Complaint ---\n");
		if (!suggestions.isEmpty()) {
			sb.append(extractSection(suggestions, "complaint", "chief complaint"));
		} else {
			sb.append("No chief complaint recorded.\n");
		}
		sb.append('\n');

		sb.append("--- Findings ---\n");
		String findingsText = extractSection(suggestions, "finding", "observation");
		sb.append(findingsText.isEmpty() ? "No specific findings recorded.\n" : findingsText);
		sb.append('\n');

		sb.append("--- Plan ---\n");
		String planText = extractSection(suggestions, "plan", "treatment", "recommendation");
		sb.append(planText.isEmpty() ? "No treatment plan recorded.\n" : planText);
		sb.append('\n');

		sb.append("--- Follow-up ---\n");
		String followUpText = extractSection(suggestions, "follow", "next", "schedule");
		sb.append(followUpText.isEmpty() ? "No follow-up instructions recorded.\n" : followUpText);
		sb.append('\n');

		sb.append("--- AI Suggestions (").append(suggestions.size()).append(" total) ---\n");
		for (int i = 0; i < suggestions.size(); i++) {
			sb.append(i + 1).append(". ").append(suggestions.get(i)).append('\n');
		}

		sb.append("\n=== END OF SUMMARY ===\n");
		return sb.toString();
	}

	private String extractSection(List<String> suggestions, String... keywords) {
		var sb = new StringBuilder();
		for (var suggestion : suggestions) {
			String lower = suggestion.toLowerCase();
			for (String keyword : keywords) {
				if (lower.contains(keyword)) {
					sb.append("• ").append(suggestion.trim()).append('\n');
					break;
				}
			}
		}
		return sb.toString();
	}
}
