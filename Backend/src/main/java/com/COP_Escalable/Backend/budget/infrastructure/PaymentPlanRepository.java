package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.PaymentPlan;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.UUID;

public interface PaymentPlanRepository extends MongoRepository<PaymentPlan, UUID> {
}
