package com.COP_Escalable.Backend.budget.application;

import com.COP_Escalable.Backend.budget.domain.PaymentInstallment;
import com.COP_Escalable.Backend.budget.domain.PaymentPlan;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;

@Component
public class PaymentSimulator {

	private static final BigDecimal CASH_DISCOUNT = new BigDecimal("0.05");
	private static final int MONTHS_PER_YEAR = 12;

	public PaymentPlan simulateCash(UUID budgetId, BigDecimal total) {
		BigDecimal discounted = total.subtract(total.multiply(CASH_DISCOUNT))
				.setScale(2, RoundingMode.HALF_UP);

		var plan = new PaymentPlan(budgetId, "CASH", 1, BigDecimal.ZERO, discounted);
		var installment = new PaymentInstallment(1, discounted, LocalDate.now().plusDays(7));
		plan.addInstallment(installment);
		return plan;
	}

	public PaymentPlan simulateInstallments(UUID budgetId, BigDecimal total,
											int numInstallments, BigDecimal annualInterestRate) {
		BigDecimal monthlyRate = annualInterestRate.divide(
				BigDecimal.valueOf(MONTHS_PER_YEAR), 10, RoundingMode.HALF_UP);

		BigDecimal monthlyPayment;
		BigDecimal totalAmount;

		if (monthlyRate.compareTo(BigDecimal.ZERO) == 0) {
			monthlyPayment = total.divide(BigDecimal.valueOf(numInstallments), 2, RoundingMode.HALF_UP);
			totalAmount = total;
		} else {
			BigDecimal onePlusR = BigDecimal.ONE.add(monthlyRate);
			BigDecimal onePlusRPowN = onePlusR.pow(numInstallments, MathContext.DECIMAL128);
			BigDecimal numerator = total.multiply(monthlyRate).multiply(onePlusRPowN);
			BigDecimal denominator = onePlusRPowN.subtract(BigDecimal.ONE);
			monthlyPayment = numerator.divide(denominator, 2, RoundingMode.HALF_UP);
			totalAmount = monthlyPayment.multiply(BigDecimal.valueOf(numInstallments));
		}

		var plan = new PaymentPlan(budgetId, "INSTALLMENTS", numInstallments, annualInterestRate, totalAmount);

		LocalDate dueDate = LocalDate.now().plusMonths(1);
		for (int i = 1; i <= numInstallments; i++) {
			BigDecimal amount = (i == numInstallments)
					? totalAmount.subtract(monthlyPayment.multiply(BigDecimal.valueOf(numInstallments - 1)))
					: monthlyPayment;
			var installment = new PaymentInstallment(i, amount, dueDate);
			plan.addInstallment(installment);
			dueDate = dueDate.plusMonths(1);
		}

		return plan;
	}

	public PaymentPlan simulateInsurance(UUID budgetId, BigDecimal total, BigDecimal coveragePercent) {
		BigDecimal coverageFraction = coveragePercent.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
		BigDecimal insurancePays = total.multiply(coverageFraction).setScale(2, RoundingMode.HALF_UP);
		BigDecimal patientCopay = total.subtract(insurancePays);

		var plan = new PaymentPlan(budgetId, "INSURANCE", 1, BigDecimal.ZERO, patientCopay);
		var installment = new PaymentInstallment(1, patientCopay, LocalDate.now().plusDays(30));
		plan.addInstallment(installment);
		return plan;
	}
}
