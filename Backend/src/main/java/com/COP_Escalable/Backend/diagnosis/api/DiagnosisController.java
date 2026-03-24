package com.COP_Escalable.Backend.diagnosis.api;

import com.COP_Escalable.Backend.diagnosis.application.DiagnosisService;
import com.COP_Escalable.Backend.diagnosis.domain.DiagnosisResult;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diagnosis")
public class DiagnosisController {

	private final DiagnosisService service;

	public DiagnosisController(DiagnosisService service) {
		this.service = service;
	}

	@PostMapping(value = "/patients/{patientId}/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ResponseEntity<?> analyzeImage(
			@PathVariable UUID patientId,
			@RequestParam("file") MultipartFile file
	) throws IOException {
		if (file.isEmpty()) {
			return ResponseEntity.badRequest().body("File is required");
		}
		String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image";
		String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

		Object result = service.analyzeImage(patientId, file.getBytes(), filename, contentType);
		return ResponseEntity.ok(result);
	}

	@GetMapping("/patients/{patientId}/results")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<DiagnosisResult> getResults(@PathVariable UUID patientId) {
		return service.getResults(patientId);
	}

	@GetMapping("/results/{resultId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public DiagnosisResult getResult(@PathVariable UUID resultId) {
		return service.getResult(resultId);
	}
}
