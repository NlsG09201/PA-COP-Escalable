package com.COP_Escalable.Backend.simulation.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Document("dental_simulations")
public class DentalSimulation {

	public enum SimulationType { ORTHODONTICS, IMPLANT, COMBINED }
	public enum Status { DRAFT, SIMULATING, COMPLETED }

	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private SimulationType simulationType;
	private Map<String, String> initialState = new LinkedHashMap<>();
	private List<SimulationPhase> phases = new ArrayList<>();
	private Status status;
	private int totalDurationMonths;
	private Instant createdAt;
	private Instant updatedAt;

	protected DentalSimulation() {}

	public DentalSimulation(UUID organizationId, UUID siteId, UUID patientId,
							SimulationType simulationType, Map<String, String> initialState) {
		this.id = UUID.randomUUID();
		this.organizationId = requireNonNull(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = requireNonNull(patientId, "patientId");
		this.simulationType = requireNonNull(simulationType, "simulationType");
		this.initialState = initialState != null ? new LinkedHashMap<>(initialState) : new LinkedHashMap<>();
		this.phases = new ArrayList<>();
		this.status = Status.DRAFT;
		this.totalDurationMonths = 0;
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public void markSimulating() {
		this.status = Status.SIMULATING;
		this.updatedAt = Instant.now();
	}

	public void applyPhases(List<SimulationPhase> newPhases) {
		this.phases = new ArrayList<>(newPhases);
		this.totalDurationMonths = newPhases.stream().mapToInt(SimulationPhase::getDurationMonths).sum();
		this.status = Status.COMPLETED;
		this.updatedAt = Instant.now();
	}

	public void addPhases(List<SimulationPhase> additionalPhases) {
		int nextNumber = this.phases.isEmpty() ? 1 : this.phases.get(this.phases.size() - 1).getPhaseNumber() + 1;
		for (var phase : additionalPhases) {
			phase.setPhaseNumber(nextNumber++);
			this.phases.add(phase);
		}
		this.totalDurationMonths = this.phases.stream().mapToInt(SimulationPhase::getDurationMonths).sum();
		this.updatedAt = Instant.now();
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public SimulationType getSimulationType() { return simulationType; }
	public Map<String, String> getInitialState() { return Map.copyOf(initialState); }
	public List<SimulationPhase> getPhases() { return phases; }
	public Status getStatus() { return status; }
	public int getTotalDurationMonths() { return totalDurationMonths; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }

	private static <T> T requireNonNull(T value, String name) {
		if (value == null) throw new IllegalArgumentException(name + " is required");
		return value;
	}
}
