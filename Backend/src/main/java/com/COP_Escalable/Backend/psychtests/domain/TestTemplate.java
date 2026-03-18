package com.COP_Escalable.Backend.psychtests.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document("psych_test_templates")
public class TestTemplate {
	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	private String code;
	private String name;
	private Instant createdAt;
	private boolean active;

	private List<Question> questions = new ArrayList<>();

	protected TestTemplate() {}

	public TestTemplate(UUID organizationId, String code, String name, List<Question> questions) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.code = requireText(code, "code");
		this.name = requireText(name, "name");
		this.createdAt = Instant.now();
		this.active = true;
		if (questions != null) this.questions = new ArrayList<>(questions);
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public String getCode() { return code; }
	public String getName() { return name; }
	public Instant getCreatedAt() { return createdAt; }
	public boolean isActive() { return active; }
	public List<Question> getQuestions() { return List.copyOf(questions); }

	public record Question(
			String id,
			String prompt,
			List<Option> options
	) {}

	public record Option(
			String id,
			String label,
			int score
	) {}

	private static UUID require(UUID v, String name) {
		if (v == null) throw new IllegalArgumentException(name + " is required");
		return v;
	}

	private static String requireText(String v, String name) {
		if (v == null || v.isBlank()) throw new IllegalArgumentException(name + " is required");
		return v.trim();
	}
}

