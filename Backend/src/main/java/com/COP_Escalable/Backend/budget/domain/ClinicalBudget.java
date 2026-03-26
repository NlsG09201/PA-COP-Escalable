package com.COP_Escalable.Backend.budget.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document(collection = "clinical_budgets")
public class ClinicalBudget {

	@Id
	private UUID id;

	@Field("organization_id")
	private UUID organizationId;

	@Field("site_id")
	private UUID siteId;

	@Field("patient_id")
	private UUID patientId;

	private String name;

	private String status;

	@Field("total_cost")
	private BigDecimal totalCost;

	private String currency;

	@Field("estimated_days")
	private Integer estimatedDays;

	private String notes;

	private List<BudgetPhase> phases = new ArrayList<>();

	@Field("created_at")
	private Instant createdAt;

	@Field("updated_at")
	private Instant updatedAt;

	protected ClinicalBudget() {}

	public ClinicalBudget(UUID organizationId, UUID siteId, UUID patientId,
						   String name, String currency) {
		this.id = UUID.randomUUID();
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.name = name;
		this.status = "DRAFT";
		this.totalCost = BigDecimal.ZERO;
		this.currency = currency;
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public BudgetPhase addPhase(String name, String description, int phaseOrder,
								BigDecimal cost, Integer durationDays) {
		var phase = new BudgetPhase(name, description, phaseOrder, cost, durationDays);
		this.phases.add(phase);
		recalculateTotal();
		return phase;
	}

	public void recalculateTotal() {
		this.totalCost = phases.stream()
				.map(BudgetPhase::getCost)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		this.estimatedDays = phases.stream()
				.map(BudgetPhase::getDurationDays)
				.filter(d -> d != null)
				.reduce(0, Integer::sum);
	}

	public void approve() {
		if (!"DRAFT".equals(this.status)) {
			throw new IllegalStateException("Only DRAFT budgets can be approved, current: " + this.status);
		}
		this.status = "APPROVED";
	}

	public void activate() {
		this.status = "ACTIVE";
	}

	public void complete() {
		this.status = "COMPLETED";
	}

	public void cancel() {
		this.status = "CANCELLED";
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public String getName() {
		return name;
	}

	public String getStatus() {
		return status;
	}

	public BigDecimal getTotalCost() {
		return totalCost;
	}

	public String getCurrency() {
		return currency;
	}

	public Integer getEstimatedDays() {
		return estimatedDays;
	}

	public String getNotes() {
		return notes;
	}

	public void setNotes(String notes) {
		this.notes = notes;
	}

	public List<BudgetPhase> getPhases() {
		return phases;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
