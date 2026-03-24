package com.COP_Escalable.Backend.budget.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "clinical_budgets")
public class ClinicalBudget {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "organization_id", nullable = false)
	private UUID organizationId;

	@Column(name = "site_id", nullable = false)
	private UUID siteId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@Column(name = "total_cost", nullable = false, precision = 12, scale = 2)
	private BigDecimal totalCost;

	@Column(name = "currency", nullable = false, length = 3)
	private String currency;

	@Column(name = "estimated_days")
	private Integer estimatedDays;

	@Column(name = "notes", columnDefinition = "TEXT")
	private String notes;

	@OneToMany(mappedBy = "budget", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("phaseOrder ASC")
	private List<BudgetPhase> phases = new ArrayList<>();

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected ClinicalBudget() {}

	public ClinicalBudget(UUID organizationId, UUID siteId, UUID patientId,
						   String name, String currency) {
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.name = name;
		this.status = "DRAFT";
		this.totalCost = BigDecimal.ZERO;
		this.currency = currency;
	}

	public BudgetPhase addPhase(String name, String description, int phaseOrder,
								BigDecimal cost, Integer durationDays) {
		var phase = new BudgetPhase(this, name, description, phaseOrder, cost, durationDays);
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

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public String getName() { return name; }
	public String getStatus() { return status; }
	public BigDecimal getTotalCost() { return totalCost; }
	public String getCurrency() { return currency; }
	public Integer getEstimatedDays() { return estimatedDays; }
	public String getNotes() { return notes; }
	public void setNotes(String notes) { this.notes = notes; }
	public List<BudgetPhase> getPhases() { return phases; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
}
