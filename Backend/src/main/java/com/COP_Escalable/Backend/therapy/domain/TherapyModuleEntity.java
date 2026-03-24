package com.COP_Escalable.Backend.therapy.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "therapy_modules")
public class TherapyModuleEntity {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "code", nullable = false, unique = true, length = 50)
	private String code;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "description", columnDefinition = "TEXT")
	private String description;

	@Column(name = "category", nullable = false, length = 50)
	private String category;

	@Column(name = "difficulty", nullable = false, length = 20)
	private String difficulty;

	@Column(name = "duration_min", nullable = false)
	private int durationMin;

	@Column(name = "content_json", nullable = false, columnDefinition = "jsonb")
	private String contentJson;

	@Column(name = "active", nullable = false)
	private boolean active;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected TherapyModuleEntity() {}

	public TherapyModuleEntity(String code, String name, String description,
							   String category, String difficulty, int durationMin,
							   String contentJson) {
		this.code = code;
		this.name = name;
		this.description = description;
		this.category = category;
		this.difficulty = difficulty;
		this.durationMin = durationMin;
		this.contentJson = contentJson;
		this.active = true;
	}

	public void deactivate() { this.active = false; }
	public void activate() { this.active = true; }

	public UUID getId() { return id; }
	public String getCode() { return code; }
	public String getName() { return name; }
	public String getDescription() { return description; }
	public String getCategory() { return category; }
	public String getDifficulty() { return difficulty; }
	public int getDurationMin() { return durationMin; }
	public String getContentJson() { return contentJson; }
	public boolean isActive() { return active; }
	public Instant getCreatedAt() { return createdAt; }
}
