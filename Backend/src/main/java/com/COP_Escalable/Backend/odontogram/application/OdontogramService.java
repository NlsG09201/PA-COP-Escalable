package com.COP_Escalable.Backend.odontogram.application;

import com.COP_Escalable.Backend.odontogram.api.OdontogramDtos;
import com.COP_Escalable.Backend.odontogram.domain.*;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class OdontogramService {
    private final OdontogramRepository repository;

    public OdontogramService(OdontogramRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Odontogram getOrCreate(UUID patientId) {
        var tenant = TenantContextHolder.require();
        return repository.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
                tenant.organizationId(), tenant.siteId(), patientId
        ).orElseGet(() -> {
            var o = new Odontogram(tenant.organizationId(), tenant.siteId(), patientId);
            return repository.save(o);
        });
    }

    @Transactional
    public Odontogram patch(UUID patientId, OdontogramDtos.PatchRequest req) {
        var o = getOrCreate(patientId);
        
        // 1. Bulk teeth status update (legacy map)
        if (req.teeth() != null) {
            req.teeth().forEach(o::upsertTooth);
        }

        // 2. Rich clinical tooth update
        if (req.clinicalTooth() != null) {
            var patch = req.clinicalTooth();
            var state = o.getClinicalTeeth().getOrDefault(patch.tooth(), new ToothClinicalState());
            
            state.setStatus(patch.status());
            state.setBraces(patch.braces());
            state.setDamages(patch.damages() != null ? new ArrayList<>(patch.damages()) : new ArrayList<>());
            state.setDiagnosis(patch.diagnosis());
            state.setTreatment(patch.treatment());
            state.setClinicalObservations(patch.clinicalObservations());
            state.setUpdatedAt(Instant.now());

            if (patch.appendHistory()) {
                var history = new ToothHistoryEvent();
                history.setAt(Instant.now());
                history.setStatus(patch.status());
                history.setDiagnosis(patch.diagnosis());
                history.setTreatment(patch.treatment());
                history.setObservations(patch.clinicalObservations());
                state.getProgressHistory().add(history);
            }

            o.upsertClinicalTooth(patch.tooth(), state);
        }

        // 3. Simulation update
        if (req.simulation() != null) {
            var simPatch = req.simulation();
            var sim = new OrthodonticSimulation();
            sim.setPlannedDurationMonths(simPatch.plannedDurationMonths());
            sim.setNotes(simPatch.notes());
            
            List<SimulationKeyframe> keyframes = simPatch.keyframes().stream().map(kp -> {
                var k = new SimulationKeyframe();
                k.setT(kp.t());
                k.setToothPoses(new HashMap<>(kp.toothPoses()));
                return k;
            }).toList();
            
            sim.setKeyframes(keyframes);
            o.setOrthoSimulation(sim);
        }

        return repository.save(o);
    }
}
