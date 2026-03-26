package com.COP_Escalable.Backend.budget.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Embedded in {@link PaymentPlan} (MongoDB subdocument).
 */
public class PaymentInstallment {

	private UUID id;
	private int installmentNum;
	private BigDecimal amount;
	private LocalDate dueDate;
	private Instant paidAt;
	private String status;

	protected PaymentInstallment() {}

	public PaymentInstallment(int installmentNum,
							  BigDecimal amount, LocalDate dueDate) {
		this.id = UUID.randomUUID();
		this.installmentNum = installmentNum;
		this.amount = amount;
		this.dueDate = dueDate;
		this.status = "PENDING";
	}

	public void markPaid() {
		this.status = "PAID";
		this.paidAt = Instant.now();
	}

	public void markOverdue() {
		this.status = "OVERDUE";
	}

	public UUID getId() {
		return id;
	}

	public int getInstallmentNum() {
		return installmentNum;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public String getStatus() {
		return status;
	}
}
