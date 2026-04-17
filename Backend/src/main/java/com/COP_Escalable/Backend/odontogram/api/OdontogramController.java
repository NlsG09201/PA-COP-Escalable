package com.COP_Escalable.Backend.odontogram.api;

import com.COP_Escalable.Backend.odontogram.application.OdontogramService;
import com.COP_Escalable.Backend.odontogram.domain.Odontogram;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/odontogram")
public class OdontogramController {
	private final OdontogramService service;

	public OdontogramController(OdontogramService service) {
		this.service = service;
	}

	@GetMapping("/{patientId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public Odontogram get(@PathVariable UUID patientId) {
		return service.getOrCreate(patientId);
	}

	@PatchMapping("/{patientId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public Odontogram patch(@PathVariable UUID patientId, @Valid @RequestBody OdontogramDtos.PatchRequest req) {
		return service.patch(patientId, req);
	}
}
