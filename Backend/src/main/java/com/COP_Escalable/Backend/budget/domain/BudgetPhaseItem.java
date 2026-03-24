package com.COP_Escalable.Backend.budget.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "budget_phase_items")
public class BudgetPhaseItem {

	@Id
	@GeneratedValue
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "phase_id", nullable = false)
	@JsonIgnore
	private BudgetPhase phase;

	@Column(name = "description", nullable = false, columnDefinition = "TEXT")
	private String description;

	@Column(name = "tooth_code", length = 10)
	private String toothCode;

	@Column(name = "quantity", nullable = false)
	private int quantity;

	@Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
	private BigDecimal unitCost;

	@Column(name = "total_cost", nullable = false, precision = 12, scale = 2)
	private BigDecimal totalCost;

	protected BudgetPhaseItem() {}

	public BudgetPhaseItem(BudgetPhase phase, String description, String toothCode,
						   int quantity, BigDecimal unitCost, BigDecimal totalCost) {
		this.phase = phase;
		this.description = description;
		this.toothCode = toothCode;
		this.quantity = quantity;
		this.unitCost = unitCost;
		this.totalCost = totalCost;
	}

	public UUID getId() { return id; }
	public BudgetPhase getPhase() { return phase; }
	public String getDescription() { return description; }
	public String getToothCode() { return toothCode; }
	public int getQuantity() { return quantity; }
	public BigDecimal getUnitCost() { return unitCost; }
	public BigDecimal getTotalCost() { return totalCost; }
}
