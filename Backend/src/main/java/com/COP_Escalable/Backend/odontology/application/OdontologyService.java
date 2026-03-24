package com.COP_Escalable.Backend.odontology.application;

import com.COP_Escalable.Backend.odontogram.domain.Odontogram;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import com.COP_Escalable.Backend.odontology.domain.TreatmentPlan;
import com.COP_Escalable.Backend.odontology.infrastructure.TreatmentPlanRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class OdontologyService {
    private final TreatmentPlanRepository repository;
    private final OdontogramRepository odontogramRepository;

    public OdontologyService(TreatmentPlanRepository repository, OdontogramRepository odontogramRepository) {
        this.repository = repository;
        this.odontogramRepository = odontogramRepository;
    }

    @Transactional
    public TreatmentPlan suggestTreatmentPlan(UUID patientId) {
        var tenant = TenantContextHolder.require();
        
        Odontogram odontogram = odontogramRepository.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
                tenant.organizationId(), tenant.siteId(), patientId
        ).orElseThrow(() -> new IllegalArgumentException("No se encontró odontograma para el paciente"));

        TreatmentPlan plan = new TreatmentPlan(
                tenant.organizationId(),
                tenant.siteId(),
                patientId,
                "Plan sugerido por protocolo - " + java.time.LocalDate.now()
        );

        // Lógica de protocolos automatizados
        Map<String, String> teeth = odontogram.getTeeth();
        for (Map.Entry<String, String> entry : teeth.entrySet()) {
            String tooth = entry.getKey();
            String state = entry.getValue().toLowerCase();

            if (state.contains("caries")) {
                plan.addStep(tooth, "Restauración de resina compuesta (Protocolo CAR-01)", 85.0);
            } else if (state.contains("missing") || state.contains("ausente")) {
                plan.addStep(tooth, "Evaluación para implante o puente (Protocolo REH-02)", 120.0);
            } else if (state.contains("endodoncia") || state.contains("pulpitis")) {
                plan.addStep(tooth, "Tratamiento de conducto (Protocolo ENDO-01)", 250.0);
            }
        }

        if (plan.getSteps().isEmpty()) {
            plan.addStep("GEN", "Profilaxis y limpieza general preventiva", 45.0);
        }

        return repository.save(plan);
    }

    @Transactional(readOnly = true)
    public List<TreatmentPlan> getPatientPlans(UUID patientId) {
        var tenant = TenantContextHolder.require();
        return repository.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
                tenant.organizationId(), tenant.siteId(), patientId
        );
    }
}
