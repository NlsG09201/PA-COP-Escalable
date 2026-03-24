package com.COP_Escalable.Backend.simulation.api;

import com.COP_Escalable.Backend.simulation.application.SimulationService;
import com.COP_Escalable.Backend.simulation.domain.DentalSimulation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

	private final SimulationService service;

	public SimulationController(SimulationService service) {
		this.service = service;
	}

	@PostMapping("/patients/{patientId}/create")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public DentalSimulation create(
			@PathVariable UUID patientId,
			@RequestParam String type
	) {
		return service.createSimulation(patientId, type);
	}

	@PostMapping("/{simulationId}/simulate-orthodontics")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public DentalSimulation simulateOrthodontics(@PathVariable UUID simulationId) {
		return service.simulateOrthodontics(simulationId);
	}

	@PostMapping("/{simulationId}/simulate-implant")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public DentalSimulation simulateImplant(
			@PathVariable UUID simulationId,
			@Valid @RequestBody ImplantRequest request
	) {
		return service.simulateImplant(simulationId, request.toothCodes());
	}

	@GetMapping("/patients/{patientId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<DentalSimulation> getSimulations(@PathVariable UUID patientId) {
		return service.getSimulations(patientId);
	}

	@GetMapping("/{simulationId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public DentalSimulation getSimulation(@PathVariable UUID simulationId) {
		return service.getSimulation(simulationId);
	}

	public record ImplantRequest(@NotEmpty List<String> toothCodes) {}
}
