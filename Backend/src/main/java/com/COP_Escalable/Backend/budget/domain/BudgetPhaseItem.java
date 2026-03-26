package com.COP_Escalable.Backend.budget.domain;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Embedded in {@link BudgetPhase} (MongoDB subdocument).
 */
public class BudgetPhaseItem {

	private UUID id;
	private String description;
	private String toothCode;
	private int quantity;
	private BigDecimal unitCost;
	private BigDecimal totalCost;

	protected BudgetPhaseItem() {}

	public BudgetPhaseItem(String description, String toothCode,
						   int quantity, BigDecimal unitCost, BigDecimal totalCost) {
		this.id = UUID.randomUUID();
		this.description = description;
		this.toothCode = toothCode;
		this.quantity = quantity;
		this.unitCost = unitCost;
		this.totalCost = totalCost;
	}

	public UUID getId() {
		return id;
	}

	public String getDescription() {
		return description;
	}

	public String getToothCode() {
		return toothCode;
	}

	public int getQuantity() {
		return quantity;
	}

	public BigDecimal getUnitCost() {
		return unitCost;
	}

	public BigDecimal getTotalCost() {
		return totalCost;
	}
}
