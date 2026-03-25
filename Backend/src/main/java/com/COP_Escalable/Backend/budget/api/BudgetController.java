package com.COP_Escalable.Backend.budget.api;

import com.COP_Escalable.Backend.budget.application.BudgetService;
import com.COP_Escalable.Backend.budget.application.BudgetService.BudgetPhaseRequest;
import com.COP_Escalable.Backend.budget.domain.ClinicalBudget;
import com.COP_Escalable.Backend.budget.domain.PaymentPlan;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/budget")
public class BudgetController {

	private final BudgetService service;

	public BudgetController(BudgetService service) {
		this.service = service;
	}

	@PostMapping("/patients/{patientId}/generate-from-plan")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalBudget generateFromPlan(@PathVariable UUID patientId,
										   @RequestParam UUID treatmentPlanId) {
		return service.generateFromTreatmentPlan(patientId, treatmentPlanId);
	}

	@PostMapping("/patients/{patientId}/generate")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalBudget generateGeneric(@PathVariable UUID patientId,
										  @RequestBody GenericBudgetRequest request) {
		return service.generateGenericBudget(patientId, request.name(), request.phases());
	}

	@GetMapping("/patients/{patientId}/budgets")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<ClinicalBudget> listBudgets(@PathVariable UUID patientId) {
		return service.getPatientBudgets(patientId);
	}

	/**
	 * Backward-compatible alias for older frontend builds:
	 * GET /api/budget/patients/{patientId} -> list budgets
	 */
	@GetMapping("/patients/{patientId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<ClinicalBudget> listBudgetsAlias(@PathVariable UUID patientId) {
		return service.getPatientBudgets(patientId);
	}

	@GetMapping("/{budgetId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalBudget getBudget(@PathVariable UUID budgetId) {
		return service.getBudget(budgetId);
	}

	@PutMapping("/{budgetId}/approve")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalBudget approve(@PathVariable UUID budgetId) {
		return service.approveBudget(budgetId);
	}

	@PostMapping("/{budgetId}/simulate-payment")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public PaymentPlan simulatePayment(@PathVariable UUID budgetId,
									   @RequestBody SimulatePaymentRequest request) {
		return service.simulatePayment(
				budgetId,
				request.planType(),
				request.installments() != null ? request.installments() : 1,
				request.interestRate() != null ? request.interestRate() : BigDecimal.ZERO
		);
	}

	public record GenericBudgetRequest(String name, List<BudgetPhaseRequest> phases) {}

	public record SimulatePaymentRequest(String planType, Integer installments, BigDecimal interestRate) {}
}
