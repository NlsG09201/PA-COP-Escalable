package com.COP_Escalable.Backend.odontogram.application;

import com.COP_Escalable.Backend.odontogram.domain.OrthodonticSimulation;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class OrthodonticSimulationService {
    private final OdontogramRepository odontogramRepository;
    private final OdontogramService odontogramService;

    public OrthodonticSimulationService(OdontogramRepository repo, OdontogramService service) {
        this.odontogramRepository = repo;
        this.odontogramService = service;
    }

    /**
     * Persiste una nueva simulación o actualiza la actual vinculándola al paciente.
     * Garantiza que los estados de los brackets se sincronicen con el Odontograma Clínico.
     */
    @Transactional
    public OrthodonticSimulation saveSimulation(UUID patientId, OrthodonticSimulation simulation) {
        var odontogram = odontogramService.getOrCreate(patientId);
        
        // Sincronización nativa: Si la simulación incluye brackets, actualizamos el estado clínico
        if (simulation.getKeyframes() != null && !simulation.getKeyframes().isEmpty()) {
            var firstFrame = simulation.getKeyframes().get(0);
            firstFrame.getToothPoses().forEach((fdi, pose) -> {
                // Actualizamos el flag de brackets en el estado clínico del diente
                odontogram.updateToothBracesState(fdi, true);
            });
        }

        odontogram.setOrthoSimulation(simulation);
        odontogramRepository.save(odontogram);
        return simulation;
    }

    /**
     * Recupera el histórico de simulaciones y el modelo 3D base generado por IA.
     */
    public Optional<OrthodonticSimulation> getActiveSimulation(UUID patientId) {
        var odontogram = odontogramService.getOrCreate(patientId);
        return Optional.ofNullable(odontogram.getOrthoSimulation());
    }
}
