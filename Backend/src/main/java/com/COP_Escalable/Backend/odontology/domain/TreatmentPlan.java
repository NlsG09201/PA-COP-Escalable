package com.COP_Escalable.Backend.odontology.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document("treatment_plans")
public class TreatmentPlan {
    @Id
    private UUID id;

    @Indexed
    private UUID organizationId;

    @Indexed
    private UUID siteId;

    @Indexed
    private UUID patientId;

    private String name;
    private String status; // DRAFT, ACTIVE, COMPLETED, CANCELLED
    private Instant createdAt;
    private Instant updatedAt;

    private List<TreatmentStep> steps = new ArrayList<>();

    protected TreatmentPlan() {}

    public TreatmentPlan(UUID organizationId, UUID siteId, UUID patientId, String name) {
        this.id = UUID.randomUUID();
        this.organizationId = organizationId;
        this.siteId = siteId;
        this.patientId = patientId;
        this.name = name;
        this.status = "DRAFT";
        var now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void addStep(String toothCode, String description, Double estimatedCost) {
        this.steps.add(new TreatmentStep(toothCode, description, estimatedCost));
        this.updatedAt = Instant.now();
    }

    public static class TreatmentStep {
        private String toothCode;
        private String description;
        private Double estimatedCost;
        private boolean completed;

        protected TreatmentStep() {}

        public TreatmentStep(String toothCode, String description, Double estimatedCost) {
            this.toothCode = toothCode;
            this.description = description;
            this.estimatedCost = estimatedCost;
            this.completed = false;
        }

        public String getToothCode() { return toothCode; }
        public String getDescription() { return description; }
        public Double getEstimatedCost() { return estimatedCost; }
        public boolean isCompleted() { return completed; }
        public void setCompleted(boolean completed) { this.completed = completed; }
    }

    // Getters
    public UUID getId() { return id; }
    public UUID getOrganizationId() { return organizationId; }
    public UUID getSiteId() { return siteId; }
    public UUID getPatientId() { return patientId; }
    public String getName() { return name; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<TreatmentStep> getSteps() { return steps; }
}
