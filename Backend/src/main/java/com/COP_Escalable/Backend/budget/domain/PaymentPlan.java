package com.COP_Escalable.Backend.budget.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "payment_plans")
public class PaymentPlan {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "budget_id", nullable = false)
	private UUID budgetId;

	@Column(name = "plan_type", nullable = false, length = 30)
	private String planType;

	@Column(name = "num_installments", nullable = false)
	private int numInstallments;

	@Column(name = "interest_rate", nullable = false, precision = 5, scale = 4)
	private BigDecimal interestRate;

	@Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal totalAmount;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("installmentNum ASC")
	private List<PaymentInstallment> installments = new ArrayList<>();

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected PaymentPlan() {}

	public PaymentPlan(UUID budgetId, String planType, int numInstallments,
					   BigDecimal interestRate, BigDecimal totalAmount) {
		this.budgetId = budgetId;
		this.planType = planType;
		this.numInstallments = numInstallments;
		this.interestRate = interestRate;
		this.totalAmount = totalAmount;
		this.status = "ACTIVE";
	}

	public void addInstallment(PaymentInstallment installment) {
		this.installments.add(installment);
	}

	public void complete() { this.status = "COMPLETED"; }
	public void cancel() { this.status = "CANCELLED"; }

	public UUID getId() { return id; }
	public UUID getBudgetId() { return budgetId; }
	public String getPlanType() { return planType; }
	public int getNumInstallments() { return numInstallments; }
	public BigDecimal getInterestRate() { return interestRate; }
	public BigDecimal getTotalAmount() { return totalAmount; }
	public String getStatus() { return status; }
	public List<PaymentInstallment> getInstallments() { return installments; }
	public Instant getCreatedAt() { return createdAt; }
}
