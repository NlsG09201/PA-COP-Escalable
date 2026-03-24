package com.COP_Escalable.Backend.psychology.api;

import com.COP_Escalable.Backend.psychology.application.PsychologyService;
import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/psychology")
public class PsychologyController {
    private final PsychologyService service;

    public PsychologyController(PsychologyService service) {
        this.service = service;
    }

    @GetMapping("/patients/{patientId}/evolution")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
    public List<PsychologicalSnapshot> getEvolution(@PathVariable UUID patientId) {
        return service.getPatientEvolution(patientId);
    }
}
