package com.COP_Escalable.Backend.psychology.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Representa una captura del estado psicologico del paciente en un punto del tiempo.
 * Integra datos de tests, notas de sesion y analisis de sentimiento por IA.
 */
@Document("psychological_snapshots")
public class PsychologicalSnapshot {
    @Id
    private UUID id;

    @Indexed
    private UUID organizationId;

    @Indexed
    private UUID siteId;

    @Indexed
    private UUID patientId;

    private Instant occurredAt;

    // Metricas cuantitativas (0.0 a 1.0 o scores especificos)
    // Ej: {"wellbeing": 0.8, "anxiety": 0.3, "depression": 0.1, "stress": 0.4}
    private Map<String, Double> metrics;

    // Analisis de sentimiento del discurso/notas
    private String predominantSentiment; // positive, neutral, negative, mixed
    private Double sentimentScore; // -1.0 a 1.0

    // Flags de riesgo critico detectados
    private boolean highRiskAlert;
    private String riskDetails;

    private String source; // SESSION_NOTES, TEST_RESULT, PATIENT_DIARY
    private UUID sourceId;

    protected PsychologicalSnapshot() {}

    public PsychologicalSnapshot(UUID organizationId, UUID siteId, UUID patientId, String source, UUID sourceId) {
        this.id = UUID.randomUUID();
        this.organizationId = organizationId;
        this.siteId = siteId;
        this.patientId = patientId;
        this.source = source;
        this.sourceId = sourceId;
        this.occurredAt = Instant.now();
    }

    public void updateMetrics(Map<String, Double> metrics) {
        this.metrics = metrics;
    }

    public void updateSentiment(String sentiment, Double score) {
        this.predominantSentiment = sentiment;
        this.sentimentScore = score;
    }

    public void markRisk(boolean alert, String details) {
        this.highRiskAlert = alert;
        this.riskDetails = details;
    }

    // Getters
    public UUID getId() { return id; }
    public UUID getOrganizationId() { return organizationId; }
    public UUID getSiteId() { return siteId; }
    public UUID getPatientId() { return patientId; }
    public Instant getOccurredAt() { return occurredAt; }
    public Map<String, Double> getMetrics() { return metrics; }
    public String getPredominantSentiment() { return predominantSentiment; }
    public Double getSentimentScore() { return sentimentScore; }
    public boolean isHighRiskAlert() { return highRiskAlert; }
    public String getRiskDetails() { return riskDetails; }
    public String getSource() { return source; }
    public UUID getSourceId() { return sourceId; }
}
