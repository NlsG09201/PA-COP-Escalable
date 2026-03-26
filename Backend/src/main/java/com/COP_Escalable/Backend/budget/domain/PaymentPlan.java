package com.COP_Escalable.Backend.budget.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document(collection = "payment_plans")
public class PaymentPlan {

	@Id
	private UUID id;

	@Field("budget_id")
	private UUID budgetId;

	@Field("plan_type")
	private String planType;

	@Field("num_installments")
	private int numInstallments;

	@Field("interest_rate")
	private BigDecimal interestRate;

	@Field("total_amount")
	private BigDecimal totalAmount;

	private String status;

	private List<PaymentInstallment> installments = new ArrayList<>();

	@Field("created_at")
	private Instant createdAt;

	protected PaymentPlan() {}

	public PaymentPlan(UUID budgetId, String planType, int numInstallments,
					   BigDecimal interestRate, BigDecimal totalAmount) {
		this.id = UUID.randomUUID();
		this.budgetId = budgetId;
		this.planType = planType;
		this.numInstallments = numInstallments;
		this.interestRate = interestRate;
		this.totalAmount = totalAmount;
		this.status = "ACTIVE";
		this.createdAt = Instant.now();
	}

	public void addInstallment(PaymentInstallment installment) {
		this.installments.add(installment);
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

	public UUID getBudgetId() {
		return budgetId;
	}

	public String getPlanType() {
		return planType;
	}

	public int getNumInstallments() {
		return numInstallments;
	}

	public BigDecimal getInterestRate() {
		return interestRate;
	}

	public BigDecimal getTotalAmount() {
		return totalAmount;
	}

	public String getStatus() {
		return status;
	}

	public List<PaymentInstallment> getInstallments() {
		return installments;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
