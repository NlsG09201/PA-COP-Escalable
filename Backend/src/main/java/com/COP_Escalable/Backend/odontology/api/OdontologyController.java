package com.COP_Escalable.Backend.odontology.api;

import com.COP_Escalable.Backend.odontology.application.OdontologyService;
import com.COP_Escalable.Backend.odontology.domain.TreatmentPlan;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/odontology")
public class OdontologyController {
    private final OdontologyService service;

    public OdontologyController(OdontologyService service) {
        this.service = service;
    }

    @PostMapping("/patients/{patientId}/suggest-plan")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
    public TreatmentPlan suggest(@PathVariable UUID patientId) {
        return service.suggestTreatmentPlan(patientId);
    }

    @GetMapping("/patients/{patientId}/plans")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
    public List<TreatmentPlan> getPlans(@PathVariable UUID patientId) {
        return service.getPatientPlans(patientId);
    }
}
