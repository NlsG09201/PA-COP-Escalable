package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.PaymentPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentPlanRepository extends JpaRepository<PaymentPlan, UUID> {

	List<PaymentPlan> findByBudgetId(UUID budgetId);
}
