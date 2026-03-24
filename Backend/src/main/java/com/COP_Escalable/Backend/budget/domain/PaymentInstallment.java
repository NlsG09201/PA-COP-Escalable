package com.COP_Escalable.Backend.budget.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "payment_installments")
public class PaymentInstallment {

	@Id
	@GeneratedValue
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "plan_id", nullable = false)
	@JsonIgnore
	private PaymentPlan plan;

	@Column(name = "installment_num", nullable = false)
	private int installmentNum;

	@Column(name = "amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal amount;

	@Column(name = "due_date", nullable = false)
	private LocalDate dueDate;

	@Column(name = "paid_at")
	private Instant paidAt;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	protected PaymentInstallment() {}

	public PaymentInstallment(PaymentPlan plan, int installmentNum,
							  BigDecimal amount, LocalDate dueDate) {
		this.plan = plan;
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

	public UUID getId() { return id; }
	public PaymentPlan getPlan() { return plan; }
	public int getInstallmentNum() { return installmentNum; }
	public BigDecimal getAmount() { return amount; }
	public LocalDate getDueDate() { return dueDate; }
	public Instant getPaidAt() { return paidAt; }
	public String getStatus() { return status; }
}
