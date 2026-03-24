package com.COP_Escalable.Backend.simulation.application;

import com.COP_Escalable.Backend.simulation.domain.SimulationPhase;
import com.COP_Escalable.Backend.simulation.domain.ToothTransform;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class OrthodonticsSimulator {

	private static final Set<String> ROTATED_INDICATORS = Set.of("rotated", "rotado", "displaced", "desplazado", "malpositioned");
	private static final Set<String> CROWDED_INDICATORS = Set.of("crowded", "apiñado", "crowding", "apiñamiento");
	private static final Set<String> GAP_INDICATORS = Set.of("gap", "diastema", "spacing", "espaciado");
	private static final Set<String> DEEP_BITE_INDICATORS = Set.of("deep_bite", "mordida_profunda", "open_bite", "mordida_abierta", "overbite");

	private final SimulationProperties properties;

	public OrthodonticsSimulator(SimulationProperties properties) {
		this.properties = properties;
	}

	public List<SimulationPhase> simulate(Map<String, String> currentTeethStates) {
		List<SimulationPhase> phases = new ArrayList<>();
		double rate = properties.getToothMovementRateMmPerMonth();

		List<String> rotatedTeeth = new ArrayList<>();
		List<String> crowdedTeeth = new ArrayList<>();
		List<String> gapTeeth = new ArrayList<>();
		List<String> biteIssueTeeth = new ArrayList<>();
		List<String> healthyTeeth = new ArrayList<>();

		for (Map.Entry<String, String> entry : currentTeethStates.entrySet()) {
			String tooth = entry.getKey();
			String state = entry.getValue().toLowerCase();

			if (matchesAny(state, ROTATED_INDICATORS)) {
				rotatedTeeth.add(tooth);
			} else if (matchesAny(state, CROWDED_INDICATORS)) {
				crowdedTeeth.add(tooth);
			} else if (matchesAny(state, GAP_INDICATORS)) {
				gapTeeth.add(tooth);
			} else if (matchesAny(state, DEEP_BITE_INDICATORS)) {
				biteIssueTeeth.add(tooth);
			} else {
				healthyTeeth.add(tooth);
			}
		}

		int phaseNum = 1;

		// Phase 1: Alignment (3-6 months)
		int alignmentMonths = calculateAlignmentDuration(rotatedTeeth, crowdedTeeth);
		if (alignmentMonths > 0) {
			SimulationPhase alignment = new SimulationPhase(phaseNum++, "Alignment", alignmentMonths,
					"Initial alignment of rotated and crowded teeth using archwire forces");

			for (String tooth : rotatedTeeth) {
				double rotCorrection = -15.0;
				double monthsNeeded = Math.abs(rotCorrection) / (rate * 2);
				double monthlyRot = rotCorrection / Math.max(monthsNeeded, 1);
				alignment.addToothState(tooth, ToothTransform.withRotation(tooth,
						0, monthlyRot * alignmentMonths, 0, "BRACKET"));
			}
			for (String tooth : crowdedTeeth) {
				double lateralMove = rate * alignmentMonths * 0.6;
				int quadrant = extractQuadrant(tooth);
				double direction = (quadrant == 1 || quadrant == 4) ? 1.0 : -1.0;
				alignment.addToothState(tooth, ToothTransform.withTranslation(tooth,
						lateralMove * direction, 0, 0, "BRACKET"));
			}
			for (String tooth : healthyTeeth) {
				alignment.addToothState(tooth, ToothTransform.identity(tooth, "BRACKET"));
			}
			phases.add(alignment);
		}

		// Phase 2: Leveling (2-4 months)
		int levelingMonths = calculateLevelingDuration(biteIssueTeeth, crowdedTeeth);
		if (levelingMonths > 0) {
			SimulationPhase leveling = new SimulationPhase(phaseNum++, "Leveling", levelingMonths,
					"Normalize vertical positions and correct bite depth issues");

			for (String tooth : biteIssueTeeth) {
				double verticalCorrection = rate * levelingMonths * 0.5;
				boolean isUpper = extractQuadrant(tooth) <= 2;
				double direction = isUpper ? 1.0 : -1.0;
				leveling.addToothState(tooth, ToothTransform.withTranslation(tooth,
						0, direction * verticalCorrection, 0, "BRACKET"));
			}
			for (String tooth : crowdedTeeth) {
				double verticalAdj = rate * levelingMonths * 0.3;
				leveling.addToothState(tooth, ToothTransform.withTranslation(tooth,
						0, verticalAdj, 0, "BRACKET"));
			}
			for (String tooth : healthyTeeth) {
				leveling.addToothState(tooth, ToothTransform.identity(tooth, "BRACKET"));
			}
			phases.add(leveling);
		}

		// Phase 3: Space closure (3-6 months)
		int spaceClosureMonths = calculateSpaceClosureDuration(gapTeeth);
		if (spaceClosureMonths > 0) {
			SimulationPhase spaceClosure = new SimulationPhase(phaseNum++, "Space Closure", spaceClosureMonths,
					"Close gaps and diastemas using sliding mechanics or loop mechanics");

			for (String tooth : gapTeeth) {
				double closureMove = rate * spaceClosureMonths;
				int quadrant = extractQuadrant(tooth);
				double direction = (quadrant == 1 || quadrant == 4) ? -1.0 : 1.0;
				spaceClosure.addToothState(tooth, ToothTransform.withTranslation(tooth,
						closureMove * direction, 0, 0, "BRACKET"));
			}
			for (String tooth : healthyTeeth) {
				spaceClosure.addToothState(tooth, ToothTransform.identity(tooth, "BRACKET"));
			}
			phases.add(spaceClosure);
		}

		// Phase 4: Finishing (2-3 months)
		int finishingMonths = Math.max(2, (int) Math.ceil(currentTeethStates.size() / 14.0));
		finishingMonths = Math.min(finishingMonths, 3);
		SimulationPhase finishing = new SimulationPhase(phaseNum++, "Finishing", finishingMonths,
				"Fine-tune occlusion, torque, and tip for ideal intercuspation");
		for (String tooth : currentTeethStates.keySet()) {
			double microAdjust = rate * 0.2;
			finishing.addToothState(tooth, ToothTransform.full(tooth,
					microAdjust * 0.1, microAdjust * 0.1, 0,
					1.0, 0, 0, "BRACKET", true));
		}
		phases.add(finishing);

		// Phase 5: Retention (ongoing, modeled as 6 months active retention)
		SimulationPhase retention = new SimulationPhase(phaseNum, "Retention", 6,
				"Retainer placement to maintain achieved positions and prevent relapse");
		for (String tooth : currentTeethStates.keySet()) {
			retention.addToothState(tooth, ToothTransform.identity(tooth, "ALIGNED"));
		}
		phases.add(retention);

		int maxPhases = properties.getMaxPhases();
		if (phases.size() > maxPhases) {
			phases = phases.subList(0, maxPhases);
		}

		return phases;
	}

	private int calculateAlignmentDuration(List<String> rotatedTeeth, List<String> crowdedTeeth) {
		int affected = rotatedTeeth.size() + crowdedTeeth.size();
		if (affected == 0) return 0;
		if (affected <= 4) return 3;
		if (affected <= 8) return 4;
		return 6;
	}

	private int calculateLevelingDuration(List<String> biteIssueTeeth, List<String> crowdedTeeth) {
		int affected = biteIssueTeeth.size() + (crowdedTeeth.size() / 2);
		if (affected == 0) return 2;
		if (affected <= 4) return 3;
		return 4;
	}

	private int calculateSpaceClosureDuration(List<String> gapTeeth) {
		if (gapTeeth.isEmpty()) return 0;
		if (gapTeeth.size() <= 2) return 3;
		if (gapTeeth.size() <= 5) return 4;
		return 6;
	}

	private int extractQuadrant(String toothCode) {
		if (toothCode == null || toothCode.length() < 2) return 1;
		try {
			return Character.getNumericValue(toothCode.charAt(0));
		} catch (Exception e) {
			return 1;
		}
	}

	private boolean matchesAny(String state, Set<String> indicators) {
		for (String indicator : indicators) {
			if (state.contains(indicator)) return true;
		}
		return false;
	}
}
