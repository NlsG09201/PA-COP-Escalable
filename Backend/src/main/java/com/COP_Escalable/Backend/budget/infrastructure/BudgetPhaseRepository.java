package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.BudgetPhase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BudgetPhaseRepository extends JpaRepository<BudgetPhase, UUID> {

	List<BudgetPhase> findByBudgetIdOrderByPhaseOrderAsc(UUID budgetId);
}
