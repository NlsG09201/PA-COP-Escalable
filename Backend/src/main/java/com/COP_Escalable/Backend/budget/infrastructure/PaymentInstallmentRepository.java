package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.PaymentInstallment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PaymentInstallmentRepository extends JpaRepository<PaymentInstallment, UUID> {

	List<PaymentInstallment> findByStatusAndDueDateBefore(String status, LocalDate date);
}
