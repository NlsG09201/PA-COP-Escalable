package com.COP_Escalable.Backend.budget.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "budget_phases")
public class BudgetPhase {

	@Id
	@GeneratedValue
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "budget_id", nullable = false)
	@JsonIgnore
	private ClinicalBudget budget;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "description", columnDefinition = "TEXT")
	private String description;

	@Column(name = "phase_order", nullable = false)
	private int phaseOrder;

	@Column(name = "cost", nullable = false, precision = 12, scale = 2)
	private BigDecimal cost;

	@Column(name = "duration_days")
	private Integer durationDays;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@OneToMany(mappedBy = "phase", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<BudgetPhaseItem> items = new ArrayList<>();

	protected BudgetPhase() {}

	public BudgetPhase(ClinicalBudget budget, String name, String description,
					   int phaseOrder, BigDecimal cost, Integer durationDays) {
		this.budget = budget;
		this.name = name;
		this.description = description;
		this.phaseOrder = phaseOrder;
		this.cost = cost != null ? cost : BigDecimal.ZERO;
		this.durationDays = durationDays;
		this.status = "PENDING";
	}

	public BudgetPhaseItem addItem(String description, String toothCode,
								   int quantity, BigDecimal unitCost) {
		BigDecimal total = unitCost.multiply(BigDecimal.valueOf(quantity));
		var item = new BudgetPhaseItem(this, description, toothCode, quantity, unitCost, total);
		this.items.add(item);
		recalculateCost();
		return item;
	}

	public void recalculateCost() {
		this.cost = items.stream()
				.map(BudgetPhaseItem::getTotalCost)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public void startProgress() { this.status = "IN_PROGRESS"; }
	public void complete() { this.status = "COMPLETED"; }

	public UUID getId() { return id; }
	public ClinicalBudget getBudget() { return budget; }
	public String getName() { return name; }
	public String getDescription() { return description; }
	public int getPhaseOrder() { return phaseOrder; }
	public BigDecimal getCost() { return cost; }
	public Integer getDurationDays() { return durationDays; }
	public String getStatus() { return status; }
	public List<BudgetPhaseItem> getItems() { return items; }
}
