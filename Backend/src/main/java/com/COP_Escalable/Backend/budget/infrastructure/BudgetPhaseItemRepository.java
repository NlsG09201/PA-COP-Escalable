package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.BudgetPhaseItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface BudgetPhaseItemRepository extends JpaRepository<BudgetPhaseItem, UUID> {
}
