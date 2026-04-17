package com.COP_Escalable.Backend.odontogram.api;

import com.COP_Escalable.Backend.odontogram.domain.ToothPose;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public final class OdontogramDtos {
	private OdontogramDtos() {}

	public record PatchRequest(
			@Size(max = 64) Map<@NotBlank String, @NotBlank String> teeth,
			@Valid ClinicalToothPatch clinicalTooth,
			@Valid SimulationPatch simulation
	) {
		public PatchRequest {
			boolean hasTeeth = teeth != null && !teeth.isEmpty();
			boolean hasClinical = clinicalTooth != null;
			boolean hasSim = simulation != null;
			if (!hasTeeth && !hasClinical && !hasSim) {
				throw new IllegalArgumentException("Provide teeth map, clinicalTooth, and/or simulation");
			}
		}
	}

	public record ClinicalToothPatch(
			@NotBlank String tooth,
			@NotBlank String status,
			boolean braces,
			@Size(max = 16) List<@NotBlank String> damages,
			@Size(max = 2000) String diagnosis,
			@Size(max = 2000) String treatment,
			@Size(max = 4000) String clinicalObservations,
			boolean appendHistory
	) {}

	public record SimulationPatch(
			@Min(1) @Max(240) int plannedDurationMonths,
			@Size(max = 2000) String notes,
			@NotNull @Size(max = 120) @Valid List<KeyframePatch> keyframes
	) {}

	public record KeyframePatch(
			@Min(0) @Max(1) double t,
			@NotNull @Size(max = 64) Map<@NotBlank String, @Valid ToothPose> toothPoses
	) {}
}
