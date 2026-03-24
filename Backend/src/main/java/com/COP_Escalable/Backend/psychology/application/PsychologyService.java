package com.COP_Escalable.Backend.psychology.application;

import com.COP_Escalable.Backend.aiassist.application.AiStructuredOutput;
import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import com.COP_Escalable.Backend.psychology.infrastructure.PsychologicalSnapshotRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PsychologyService {
    private static final Logger log = LoggerFactory.getLogger(PsychologyService.class);
    private final PsychologicalSnapshotRepository repository;
    private final ObjectMapper objectMapper;

    public PsychologyService(PsychologicalSnapshotRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PsychologicalSnapshot captureFromAiSuggestion(UUID patientId, String source, UUID sourceId, String structuredJson) {
        var tenant = TenantContextHolder.require();
        
        try {
            AiStructuredOutput output = objectMapper.readValue(structuredJson, AiStructuredOutput.class);
            PsychologicalSnapshot snapshot = new PsychologicalSnapshot(
                    tenant.organizationId(),
                    tenant.siteId(),
                    patientId,
                    source,
                    sourceId
            );

            // Mapear métricas de IA
            if (output.getClinicalMetrics() != null && !output.getClinicalMetrics().isEmpty()) {
                snapshot.updateMetrics(output.getClinicalMetrics());
            }

            // Mapear sentimiento
            if (output.getSentimentAnalysis() != null) {
                snapshot.updateSentiment(
                        output.getSentimentAnalysis().getLabel(),
                        output.getSentimentAnalysis().getScore()
                );
            }

            // Mapear riesgo
            if ("critical".equalsIgnoreCase(output.getRiskLevel())) {
                snapshot.markRisk(true, "Detectado por IA: " + output.getDisclaimer());
            }

            return repository.save(snapshot);
        } catch (Exception e) {
            log.error("Error al capturar snapshot psicologico desde IA: {}", e.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<PsychologicalSnapshot> getPatientEvolution(UUID patientId) {
        var tenant = TenantContextHolder.require();
        return repository.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByOccurredAtDesc(
                tenant.organizationId(),
                tenant.siteId(),
                patientId
        );
    }
}
