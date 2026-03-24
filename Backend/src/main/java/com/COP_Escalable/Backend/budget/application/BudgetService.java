package com.COP_Escalable.Backend.budget.application;

import com.COP_Escalable.Backend.budget.domain.BudgetPhase;
import com.COP_Escalable.Backend.budget.domain.ClinicalBudget;
import com.COP_Escalable.Backend.budget.domain.PaymentPlan;
import com.COP_Escalable.Backend.budget.infrastructure.ClinicalBudgetRepository;
import com.COP_Escalable.Backend.budget.infrastructure.PaymentPlanRepository;
import com.COP_Escalable.Backend.odontology.domain.TreatmentPlan;
import com.COP_Escalable.Backend.odontology.infrastructure.TreatmentPlanRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BudgetService {

	private static final Logger log = LoggerFactory.getLogger(BudgetService.class);

	private static final Map<String, BigDecimal> PROCEDURE_COSTS = Map.ofEntries(
			Map.entry("caries", new BigDecimal("150000")),
			Map.entry("restauración", new BigDecimal("150000")),
			Map.entry("restauracion", new BigDecimal("150000")),
			Map.entry("resina", new BigDecimal("150000")),
			Map.entry("extracción", new BigDecimal("200000")),
			Map.entry("extraccion", new BigDecimal("200000")),
			Map.entry("extraction", new BigDecimal("200000")),
			Map.entry("implante", new BigDecimal("2500000")),
			Map.entry("implant", new BigDecimal("2500000")),
			Map.entry("endodoncia", new BigDecimal("450000")),
			Map.entry("conducto", new BigDecimal("450000")),
			Map.entry("root canal", new BigDecimal("450000")),
			Map.entry("limpieza", new BigDecimal("80000")),
			Map.entry("profilaxis", new BigDecimal("80000")),
			Map.entry("cleaning", new BigDecimal("80000")),
			Map.entry("corona", new BigDecimal("600000")),
			Map.entry("crown", new BigDecimal("600000")),
			Map.entry("ortodoncia", new BigDecimal("3500000")),
			Map.entry("blanqueamiento", new BigDecimal("350000")),
			Map.entry("puente", new BigDecimal("1800000"))
	);

	private static final BigDecimal DEFAULT_PROCEDURE_COST = new BigDecimal("200000");

	private final ClinicalBudgetRepository budgetRepository;
	private final PaymentPlanRepository paymentPlanRepository;
	private final TreatmentPlanRepository treatmentPlanRepository;
	private final PaymentSimulator paymentSimulator;
	private final BudgetProperties properties;

	public BudgetService(ClinicalBudgetRepository budgetRepository,
						 PaymentPlanRepository paymentPlanRepository,
						 TreatmentPlanRepository treatmentPlanRepository,
						 PaymentSimulator paymentSimulator,
						 BudgetProperties properties) {
		this.budgetRepository = budgetRepository;
		this.paymentPlanRepository = paymentPlanRepository;
		this.treatmentPlanRepository = treatmentPlanRepository;
		this.paymentSimulator = paymentSimulator;
		this.properties = properties;
	}

	@Transactional
	public ClinicalBudget generateFromTreatmentPlan(UUID patientId, UUID treatmentPlanId) {
		var tenant = TenantContextHolder.require();

		TreatmentPlan plan = treatmentPlanRepository.findById(treatmentPlanId)
				.orElseThrow(() -> new IllegalArgumentException("Treatment plan not found: " + treatmentPlanId));

		var budget = new ClinicalBudget(
				tenant.organizationId(), tenant.siteId(), patientId,
				"Presupuesto - " + plan.getName(), properties.getCurrency()
		);

		Map<String, List<TreatmentPlan.TreatmentStep>> groupedByProcedure = new java.util.LinkedHashMap<>();
		for (TreatmentPlan.TreatmentStep step : plan.getSteps()) {
			String key = classifyProcedure(step.getDescription());
			groupedByProcedure.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(step);
		}

		int phaseOrder = 0;
		for (Map.Entry<String, List<TreatmentPlan.TreatmentStep>> entry : groupedByProcedure.entrySet()) {
			String procedureName = entry.getKey();
			List<TreatmentPlan.TreatmentStep> steps = entry.getValue();

			BudgetPhase phase = budget.addPhase(
					"Fase " + (phaseOrder + 1) + ": " + capitalize(procedureName),
					"Procedimientos de " + procedureName,
					phaseOrder,
					BigDecimal.ZERO,
					estimateDurationDays(procedureName)
			);

			for (TreatmentPlan.TreatmentStep step : steps) {
				BigDecimal unitCost = step.getEstimatedCost() != null
						? BigDecimal.valueOf(step.getEstimatedCost())
						: lookupProcedureCost(step.getDescription());
				phase.addItem(step.getDescription(), step.getToothCode(), 1, unitCost);
			}

			phase.recalculateCost();
			phaseOrder++;
		}

		budget.recalculateTotal();
		var saved = budgetRepository.save(budget);
		log.info("Generated budget {} from treatment plan {} for patient {}", saved.getId(), treatmentPlanId, patientId);
		return saved;
	}

	@Transactional
	public ClinicalBudget generateGenericBudget(UUID patientId, String name, List<BudgetPhaseRequest> phases) {
		var tenant = TenantContextHolder.require();

		var budget = new ClinicalBudget(
				tenant.organizationId(), tenant.siteId(), patientId,
				name, properties.getCurrency()
		);

		for (int i = 0; i < phases.size(); i++) {
			BudgetPhaseRequest pr = phases.get(i);
			BudgetPhase phase = budget.addPhase(
					pr.name(), pr.description(), i,
					BigDecimal.ZERO, pr.durationDays()
			);

			if (pr.items() != null) {
				for (BudgetItemRequest item : pr.items()) {
					phase.addItem(item.description(), item.toothCode(), item.quantity(), item.unitCost());
				}
				phase.recalculateCost();
			}
		}

		budget.recalculateTotal();
		var saved = budgetRepository.save(budget);
		log.info("Generated generic budget {} for patient {}", saved.getId(), patientId);
		return saved;
	}

	@Transactional
	public ClinicalBudget approveBudget(UUID budgetId) {
		var budget = loadBudget(budgetId);
		budget.approve();
		return budgetRepository.save(budget);
	}

	@Transactional
	public PaymentPlan simulatePayment(UUID budgetId, String planType, int installments, BigDecimal interestRate) {
		var budget = loadBudget(budgetId);
		BigDecimal total = budget.getTotalCost();

		PaymentPlan plan = switch (planType.toUpperCase()) {
			case "CASH" -> paymentSimulator.simulateCash(budgetId, total);
			case "INSTALLMENTS" -> paymentSimulator.simulateInstallments(budgetId, total, installments, interestRate);
			case "INSURANCE" -> paymentSimulator.simulateInsurance(budgetId, total,
					interestRate != null ? interestRate : new BigDecimal("80"));
			default -> throw new IllegalArgumentException("Unknown plan type: " + planType);
		};

		return paymentPlanRepository.save(plan);
	}

	@Transactional(readOnly = true)
	public List<ClinicalBudget> getPatientBudgets(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return budgetRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	@Transactional(readOnly = true)
	public ClinicalBudget getBudget(UUID budgetId) {
		return loadBudget(budgetId);
	}

	private ClinicalBudget loadBudget(UUID budgetId) {
		return budgetRepository.findById(budgetId)
				.orElseThrow(() -> new IllegalArgumentException("Budget not found: " + budgetId));
	}

	private BigDecimal lookupProcedureCost(String description) {
		if (description == null) return DEFAULT_PROCEDURE_COST;
		String lower = description.toLowerCase();
		for (Map.Entry<String, BigDecimal> entry : PROCEDURE_COSTS.entrySet()) {
			if (lower.contains(entry.getKey())) {
				return entry.getValue();
			}
		}
		return DEFAULT_PROCEDURE_COST;
	}

	private String classifyProcedure(String description) {
		if (description == null) return "general";
		String lower = description.toLowerCase();
		if (lower.contains("caries") || lower.contains("resina") || lower.contains("restaur")) return "restauración";
		if (lower.contains("extract") || lower.contains("extrac")) return "extracción";
		if (lower.contains("implant")) return "implante";
		if (lower.contains("endodoncia") || lower.contains("conducto")) return "endodoncia";
		if (lower.contains("limpieza") || lower.contains("profilaxis")) return "limpieza";
		if (lower.contains("corona") || lower.contains("crown")) return "corona";
		if (lower.contains("ortodoncia")) return "ortodoncia";
		if (lower.contains("puente") || lower.contains("bridge")) return "puente";
		return "general";
	}

	private Integer estimateDurationDays(String procedure) {
		return switch (procedure) {
			case "implante" -> 120;
			case "ortodoncia" -> 365;
			case "endodoncia" -> 14;
			case "corona", "puente" -> 21;
			case "extracción" -> 7;
			default -> 3;
		};
	}

	private String capitalize(String s) {
		if (s == null || s.isEmpty()) return s;
		return s.substring(0, 1).toUpperCase() + s.substring(1);
	}

	public record BudgetPhaseRequest(String name, String description, Integer durationDays,
									 List<BudgetItemRequest> items) {}

	public record BudgetItemRequest(String description, String toothCode, int quantity, BigDecimal unitCost) {}
}
