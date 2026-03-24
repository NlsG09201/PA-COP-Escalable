package com.COP_Escalable.Backend.simulation.application;

import com.COP_Escalable.Backend.simulation.domain.SimulationPhase;
import com.COP_Escalable.Backend.simulation.domain.ToothTransform;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ImplantSimulator {

	private final SimulationProperties properties;

	public ImplantSimulator(SimulationProperties properties) {
		this.properties = properties;
	}

	public List<SimulationPhase> simulate(List<String> missingTeethCodes, Map<String, String> currentStates) {
		List<SimulationPhase> phases = new ArrayList<>();
		int phaseNum = 1;

		// Phase 1: Pre-surgical evaluation (1 month)
		SimulationPhase evaluation = new SimulationPhase(phaseNum++, "Pre-surgical Evaluation", 1,
				"CBCT imaging, bone density assessment, treatment planning and surgical guide fabrication");
		for (String tooth : missingTeethCodes) {
			evaluation.addToothState(tooth, ToothTransform.full(tooth,
					0, 0, 0, 0, 0, 0, "EXTRACTED", false));
		}
		for (Map.Entry<String, String> entry : currentStates.entrySet()) {
			if (!missingTeethCodes.contains(entry.getKey())) {
				evaluation.addToothState(entry.getKey(),
						ToothTransform.identity(entry.getKey(), mapToStatus(entry.getValue())));
			}
		}
		phases.add(evaluation);

		// Phase 2: Implant placement (1 month per implant, grouped in surgical sessions)
		int surgicalSessions = (int) Math.ceil(missingTeethCodes.size() / 3.0);
		int placementMonths = Math.max(1, surgicalSessions);

		SimulationPhase placement = new SimulationPhase(phaseNum++, "Implant Placement", placementMonths,
				"Surgical placement of " + missingTeethCodes.size() + " implant fixture(s) with guided surgery protocol");
		for (String tooth : missingTeethCodes) {
			double insertionDepth = calculateInsertionDepth(tooth);
			placement.addToothState(tooth, ToothTransform.full(tooth,
					0, -insertionDepth, 0,
					0, 0, 0, "IMPLANT", true));
		}
		for (Map.Entry<String, String> entry : currentStates.entrySet()) {
			if (!missingTeethCodes.contains(entry.getKey())) {
				placement.addToothState(entry.getKey(),
						ToothTransform.identity(entry.getKey(), mapToStatus(entry.getValue())));
			}
		}
		phases.add(placement);

		// Phase 3: Osseointegration (3-6 months depending on location)
		int osseoMonths = calculateOsseointegrationMonths(missingTeethCodes);
		SimulationPhase osseointegration = new SimulationPhase(phaseNum++, "Osseointegration", osseoMonths,
				"Healing period for bone integration around implant fixtures. Temporary prosthesis may be used.");
		for (String tooth : missingTeethCodes) {
			osseointegration.addToothState(tooth, ToothTransform.full(tooth,
					0, 0, 0,
					0, 0, 0, "IMPLANT", true));
		}
		for (Map.Entry<String, String> entry : currentStates.entrySet()) {
			if (!missingTeethCodes.contains(entry.getKey())) {
				osseointegration.addToothState(entry.getKey(),
						ToothTransform.identity(entry.getKey(), mapToStatus(entry.getValue())));
			}
		}
		phases.add(osseointegration);

		// Phase 4: Prosthetic loading (1-2 months)
		int loadingMonths = missingTeethCodes.size() <= 2 ? 1 : 2;
		SimulationPhase prostheticLoading = new SimulationPhase(phaseNum, "Prosthetic Loading", loadingMonths,
				"Abutment connection and final crown/bridge fabrication and cementation");
		for (String tooth : missingTeethCodes) {
			double crownHeight = estimateCrownHeight(tooth);
			prostheticLoading.addToothState(tooth, ToothTransform.full(tooth,
					0, crownHeight, 0,
					0, 0, 0, "IMPLANT", true));
		}
		for (Map.Entry<String, String> entry : currentStates.entrySet()) {
			if (!missingTeethCodes.contains(entry.getKey())) {
				prostheticLoading.addToothState(entry.getKey(),
						ToothTransform.identity(entry.getKey(), mapToStatus(entry.getValue())));
			}
		}
		phases.add(prostheticLoading);

		int maxPhases = properties.getMaxPhases();
		if (phases.size() > maxPhases) {
			phases = phases.subList(0, maxPhases);
		}

		return phases;
	}

	private double calculateInsertionDepth(String toothCode) {
		if (toothCode == null || toothCode.length() < 2) return 10.0;
		int toothNumber = 0;
		try {
			toothNumber = Integer.parseInt(toothCode.substring(1));
		} catch (NumberFormatException e) {
			return 10.0;
		}
		// Anterior teeth (1-3): shorter implants ~10mm
		// Premolars (4-5): medium ~11.5mm
		// Molars (6-8): longer ~13mm
		if (toothNumber <= 3) return 10.0;
		if (toothNumber <= 5) return 11.5;
		return 13.0;
	}

	private int calculateOsseointegrationMonths(List<String> missingTeethCodes) {
		boolean hasMolars = missingTeethCodes.stream().anyMatch(code -> {
			if (code == null || code.length() < 2) return false;
			try {
				int num = Integer.parseInt(code.substring(1));
				return num >= 6;
			} catch (NumberFormatException e) {
				return false;
			}
		});
		// Molars in posterior region need longer healing (5-6 months)
		// Anterior region heals faster (3-4 months)
		if (hasMolars) return 5;
		return 3;
	}

	private double estimateCrownHeight(String toothCode) {
		if (toothCode == null || toothCode.length() < 2) return 8.0;
		int toothNumber = 0;
		try {
			toothNumber = Integer.parseInt(toothCode.substring(1));
		} catch (NumberFormatException e) {
			return 8.0;
		}
		// Crown heights: incisors ~10mm, canines ~11mm, premolars ~8mm, molars ~7mm
		if (toothNumber == 1 || toothNumber == 2) return 10.0;
		if (toothNumber == 3) return 11.0;
		if (toothNumber <= 5) return 8.0;
		return 7.0;
	}

	private String mapToStatus(String odontogramState) {
		if (odontogramState == null) return "HEALTHY";
		String lower = odontogramState.toLowerCase();
		if (lower.contains("caries")) return "CARIES";
		if (lower.contains("missing") || lower.contains("ausente") || lower.contains("extracted")) return "EXTRACTED";
		if (lower.contains("implant")) return "IMPLANT";
		return "HEALTHY";
	}
}
