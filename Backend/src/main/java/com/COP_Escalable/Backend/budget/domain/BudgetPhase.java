package com.COP_Escalable.Backend.budget.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Embedded in {@link ClinicalBudget} (MongoDB subdocument).
 */
public class BudgetPhase {

	private UUID id;
	private String name;
	private String description;
	private int phaseOrder;
	private BigDecimal cost;
	private Integer durationDays;
	private String status;
	private List<BudgetPhaseItem> items = new ArrayList<>();

	protected BudgetPhase() {}

	public BudgetPhase(String name, String description,
					   int phaseOrder, BigDecimal cost, Integer durationDays) {
		this.id = UUID.randomUUID();
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
		var item = new BudgetPhaseItem(description, toothCode, quantity, unitCost, total);
		this.items.add(item);
		recalculateCost();
		return item;
	}

	public void recalculateCost() {
		this.cost = items.stream()
				.map(BudgetPhaseItem::getTotalCost)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public void startProgress() {
		this.status = "IN_PROGRESS";
	}

	public void complete() {
		this.status = "COMPLETED";
	}

	public UUID getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public int getPhaseOrder() {
		return phaseOrder;
	}

	public BigDecimal getCost() {
		return cost;
	}

	public Integer getDurationDays() {
		return durationDays;
	}

	public String getStatus() {
		return status;
	}

	public List<BudgetPhaseItem> getItems() {
		return items;
	}
}
