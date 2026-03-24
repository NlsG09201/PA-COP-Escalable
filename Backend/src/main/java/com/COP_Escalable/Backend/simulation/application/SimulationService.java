package com.COP_Escalable.Backend.simulation.application;

import com.COP_Escalable.Backend.odontogram.domain.Odontogram;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.simulation.domain.DentalSimulation;
import com.COP_Escalable.Backend.simulation.domain.DentalSimulation.SimulationType;
import com.COP_Escalable.Backend.simulation.domain.SimulationPhase;
import com.COP_Escalable.Backend.simulation.infrastructure.DentalSimulationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SimulationService {

	private final DentalSimulationRepository simulationRepository;
	private final OdontogramRepository odontogramRepository;
	private final OrthodonticsSimulator orthodonticsSimulator;
	private final ImplantSimulator implantSimulator;

	public SimulationService(
			DentalSimulationRepository simulationRepository,
			OdontogramRepository odontogramRepository,
			OrthodonticsSimulator orthodonticsSimulator,
			ImplantSimulator implantSimulator
	) {
		this.simulationRepository = simulationRepository;
		this.odontogramRepository = odontogramRepository;
		this.orthodonticsSimulator = orthodonticsSimulator;
		this.implantSimulator = implantSimulator;
	}

	@Transactional
	public DentalSimulation createSimulation(UUID patientId, String type) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");

		SimulationType simulationType = parseSimulationType(type);

		Odontogram odontogram = odontogramRepository
				.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
						tenant.organizationId(), tenant.siteId(), patientId)
				.orElseThrow(() -> new IllegalArgumentException("No odontogram found for patient"));

		Map<String, String> initialState = odontogram.getTeeth();
		if (initialState.isEmpty()) {
			throw new IllegalArgumentException("Odontogram has no tooth data to simulate");
		}

		var simulation = new DentalSimulation(
				tenant.organizationId(), tenant.siteId(), patientId,
				simulationType, initialState
		);
		return simulationRepository.save(simulation);
	}

	@Transactional
	public DentalSimulation simulateOrthodontics(UUID simulationId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");

		DentalSimulation simulation = loadAndValidate(simulationId, tenant.organizationId(), tenant.siteId());

		if (simulation.getSimulationType() != SimulationType.ORTHODONTICS
				&& simulation.getSimulationType() != SimulationType.COMBINED) {
			throw new IllegalArgumentException("Simulation type must be ORTHODONTICS or COMBINED for orthodontic simulation");
		}

		simulation.markSimulating();
		simulationRepository.save(simulation);

		List<SimulationPhase> phases = orthodonticsSimulator.simulate(simulation.getInitialState());
		simulation.applyPhases(phases);
		return simulationRepository.save(simulation);
	}

	@Transactional
	public DentalSimulation simulateImplant(UUID simulationId, List<String> toothCodes) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");

		if (toothCodes == null || toothCodes.isEmpty()) {
			throw new IllegalArgumentException("At least one tooth code is required for implant simulation");
		}

		DentalSimulation simulation = loadAndValidate(simulationId, tenant.organizationId(), tenant.siteId());

		if (simulation.getSimulationType() != SimulationType.IMPLANT
				&& simulation.getSimulationType() != SimulationType.COMBINED) {
			throw new IllegalArgumentException("Simulation type must be IMPLANT or COMBINED for implant simulation");
		}

		simulation.markSimulating();
		simulationRepository.save(simulation);

		List<SimulationPhase> phases = implantSimulator.simulate(toothCodes, simulation.getInitialState());

		if (simulation.getSimulationType() == SimulationType.COMBINED && !simulation.getPhases().isEmpty()) {
			simulation.addPhases(phases);
		} else {
			simulation.applyPhases(phases);
		}
		return simulationRepository.save(simulation);
	}

	@Transactional(readOnly = true)
	public List<DentalSimulation> getSimulations(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		return simulationRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	@Transactional(readOnly = true)
	public DentalSimulation getSimulation(UUID simulationId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		return loadAndValidate(simulationId, tenant.organizationId(), tenant.siteId());
	}

	private DentalSimulation loadAndValidate(UUID simulationId, UUID organizationId, UUID siteId) {
		var simulation = simulationRepository.findById(simulationId)
				.orElseThrow(() -> new IllegalArgumentException("Simulation not found: " + simulationId));
		if (!organizationId.equals(simulation.getOrganizationId()) || !siteId.equals(simulation.getSiteId())) {
			throw new IllegalArgumentException("Simulation not found: " + simulationId);
		}
		return simulation;
	}

	private SimulationType parseSimulationType(String type) {
		if (type == null || type.isBlank()) {
			throw new IllegalArgumentException("Simulation type is required (ORTHODONTICS, IMPLANT, or COMBINED)");
		}
		try {
			return SimulationType.valueOf(type.trim().toUpperCase());
		} catch (IllegalArgumentException e) {
			throw new IllegalArgumentException("Invalid simulation type: " + type + ". Must be ORTHODONTICS, IMPLANT, or COMBINED");
		}
	}
}
