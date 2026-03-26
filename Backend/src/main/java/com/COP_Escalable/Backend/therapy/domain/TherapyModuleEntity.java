package com.COP_Escalable.Backend.therapy.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "therapy_modules")
public class TherapyModuleEntity {

	@Id
	private UUID id;

	private String code;

	private String name;

	private String description;

	private String category;

	private String difficulty;

	@Field("duration_min")
	private int durationMin;

	@Field("content_json")
	private String contentJson;

	private boolean active;

	@Field("created_at")
	private Instant createdAt;

	protected TherapyModuleEntity() {}

	public TherapyModuleEntity(String code, String name, String description,
							   String category, String difficulty, int durationMin,
							   String contentJson) {
		this.id = UUID.randomUUID();
		this.code = code;
		this.name = name;
		this.description = description;
		this.category = category;
		this.difficulty = difficulty;
		this.durationMin = durationMin;
		this.contentJson = contentJson;
		this.active = true;
		this.createdAt = Instant.now();
	}

	public void deactivate() {
		this.active = false;
	}

	public void activate() {
		this.active = true;
	}

	public UUID getId() {
		return id;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public String getCategory() {
		return category;
	}

	public String getDifficulty() {
		return difficulty;
	}

	public int getDurationMin() {
		return durationMin;
	}

	public String getContentJson() {
		return contentJson;
	}

	public boolean isActive() {
		return active;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
