package com.COP_Escalable.Backend.diagnosis.application;

import com.COP_Escalable.Backend.diagnosis.domain.DiagnosisResult;
import com.COP_Escalable.Backend.diagnosis.domain.DiagnosticImage;
import com.COP_Escalable.Backend.diagnosis.domain.Finding;
import com.COP_Escalable.Backend.diagnosis.infrastructure.DiagnosisResultRepository;
import com.COP_Escalable.Backend.diagnosis.infrastructure.DiagnosticImageRepository;
import com.COP_Escalable.Backend.shared.infrastructure.GridFsStorageService;
import com.COP_Escalable.Backend.shared.infrastructure.RedisStreamEventPublisher;
import com.COP_Escalable.Backend.shared.infrastructure.StreamEventTypes;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DiagnosisService {

	private static final Logger log = LoggerFactory.getLogger(DiagnosisService.class);

	private final DiagnosticImageRepository imageRepository;
	private final DiagnosisResultRepository resultRepository;
	private final GridFsStorageService gridFsStorageService;
	private final RedisStreamEventPublisher redisPublisher;
	private final DiagnosisProperties properties;
	private final ObjectMapper objectMapper;
	private final RestClient restClient;

	public DiagnosisService(
			DiagnosticImageRepository imageRepository,
			DiagnosisResultRepository resultRepository,
			GridFsStorageService gridFsStorageService,
			RedisStreamEventPublisher redisPublisher,
			DiagnosisProperties properties,
			ObjectMapper objectMapper,
			RestClient.Builder restClientBuilder
	) {
		this.imageRepository = imageRepository;
		this.resultRepository = resultRepository;
		this.gridFsStorageService = gridFsStorageService;
		this.redisPublisher = redisPublisher;
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.restClient = restClientBuilder.baseUrl(properties.getServiceUrl()).build();
	}

	@Transactional
	public Object analyzeImage(UUID patientId, byte[] imageData, String filename, String contentType) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");

		String gridFsId = gridFsStorageService.store(imageData, filename, contentType);

		var image = new DiagnosticImage(
				tenant.organizationId(), tenant.siteId(), patientId,
				gridFsId, filename, contentType
		);
		imageRepository.save(image);

		if (properties.isAsync() && properties.getRedisStream().isEnabled()) {
			image.markAnalyzing();
			imageRepository.save(image);

			Map<String, Object> payload = new LinkedHashMap<>();
			payload.put("imageId", image.getId().toString());
			payload.put("patientId", patientId.toString());
			payload.put("organizationId", tenant.organizationId().toString());
			payload.put("siteId", tenant.siteId().toString());
			payload.put("gridFsFileId", gridFsId);
			payload.put("filename", filename);
			payload.put("contentType", contentType);

			redisPublisher.publish(
					StreamEventTypes.DIAGNOSIS_REQUESTS,
					"DIAGNOSIS_REQUESTED",
					payload
			);

			return Map.of(
					"imageId", image.getId(),
					"status", image.getStatus(),
					"message", "Image queued for async analysis"
			);
		}

		return analyzeSync(image, imageData, filename, contentType);
	}

	private DiagnosisResult analyzeSync(DiagnosticImage image, byte[] imageData, String filename, String contentType) {
		image.markAnalyzing();
		imageRepository.save(image);

		long startMs = System.currentTimeMillis();
		try {
			var fileResource = new ByteArrayResource(imageData) {
				@Override
				public String getFilename() {
					return filename;
				}
			};

			var multipartBody = new LinkedMultiValueMap<String, Object>();
			multipartBody.add("file", fileResource);

			String responseBody = restClient.post()
					.uri("/api/diagnosis/analyze")
					.contentType(MediaType.MULTIPART_FORM_DATA)
					.body(multipartBody)
					.retrieve()
					.body(String.class);

			long elapsed = System.currentTimeMillis() - startMs;
			List<Finding> findings = parseFindings(responseBody);
			String modelVersion = extractModelVersion(responseBody);

			image.markCompleted();
			imageRepository.save(image);

			var result = DiagnosisResult.completed(
					image.getOrganizationId(), image.getSiteId(), image.getPatientId(),
					image.getId(), findings, modelVersion, elapsed
			);
			return resultRepository.save(result);
		} catch (RestClientResponseException e) {
			long elapsed = System.currentTimeMillis() - startMs;
			log.error("Sync diagnosis analysis failed for image {} (HTTP {}): {}",
					image.getId(), e.getStatusCode(), e.getResponseBodyAsString(), e);
			return handleSyncFailure(image, elapsed);
		} catch (Exception e) {
			long elapsed = System.currentTimeMillis() - startMs;
			log.error("Sync diagnosis analysis failed for image {}: {}", image.getId(), e.getMessage(), e);
			return handleSyncFailure(image, elapsed);
		}
	}

	private DiagnosisResult handleSyncFailure(DiagnosticImage image, long elapsed) {
		image.markFailed();
		imageRepository.save(image);

		var failedResult = DiagnosisResult.failed(
				image.getOrganizationId(), image.getSiteId(), image.getPatientId(),
				image.getId(), "unknown", elapsed
		);
		return resultRepository.save(failedResult);
	}

	public void processAsyncResult(String imageIdStr, String resultJson) {
		UUID imageId;
		try {
			imageId = UUID.fromString(imageIdStr);
		} catch (IllegalArgumentException e) {
			log.error("Invalid imageId in async result: {}", imageIdStr);
			return;
		}

		var imageOpt = imageRepository.findById(imageId);
		if (imageOpt.isEmpty()) {
			log.warn("DiagnosticImage not found for async result: {}", imageId);
			return;
		}

		var image = imageOpt.get();
		if (image.getStatus() == DiagnosticImage.Status.COMPLETED || image.getStatus() == DiagnosticImage.Status.FAILED) {
			log.debug("Image {} already in terminal state {}, skipping", imageId, image.getStatus());
			return;
		}

		try {
			List<Finding> findings = parseFindings(resultJson);
			String modelVersion = extractModelVersion(resultJson);
			long processingTimeMs = extractProcessingTimeMs(resultJson);

			image.markCompleted();
			imageRepository.save(image);

			var result = DiagnosisResult.completed(
					image.getOrganizationId(), image.getSiteId(), image.getPatientId(),
					image.getId(), findings, modelVersion, processingTimeMs
			);
			resultRepository.save(result);
			log.info("Async diagnosis result saved for image {}: {} findings", imageId, findings.size());
		} catch (Exception e) {
			log.error("Failed to process async diagnosis result for image {}: {}", imageId, e.getMessage(), e);

			image.markFailed();
			imageRepository.save(image);

			var failedResult = DiagnosisResult.failed(
					image.getOrganizationId(), image.getSiteId(), image.getPatientId(),
					image.getId(), "unknown", 0
			);
			resultRepository.save(failedResult);
		}
	}

	@Transactional(readOnly = true)
	public List<DiagnosisResult> getResults(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		return resultRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	@Transactional(readOnly = true)
	public DiagnosisResult getResultByImage(UUID imageId) {
		return resultRepository.findByImageId(imageId)
				.orElseThrow(() -> new IllegalArgumentException("No diagnosis result found for image: " + imageId));
	}

	@Transactional(readOnly = true)
	public DiagnosisResult getResult(UUID resultId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		var result = resultRepository.findById(resultId)
				.orElseThrow(() -> new IllegalArgumentException("Diagnosis result not found: " + resultId));
		if (!tenant.organizationId().equals(result.getOrganizationId()) || !tenant.siteId().equals(result.getSiteId())) {
			throw new IllegalArgumentException("Diagnosis result not found: " + resultId);
		}
		return result;
	}

	private List<Finding> parseFindings(String json) {
		if (json == null || json.isBlank()) return List.of();
		try {
			JsonNode root = objectMapper.readTree(json);
			JsonNode findingsNode = root.has("findings") ? root.get("findings") : root;
			if (findingsNode.isArray()) {
				List<Finding> findings = new ArrayList<>();
				for (JsonNode node : findingsNode) {
					String label = node.has("label") ? node.get("label").asText("HEALTHY") : "HEALTHY";
					double confidence = node.has("confidence") ? node.get("confidence").asDouble(0.0) : 0.0;
					String description = node.has("description") ? node.get("description").asText("") : "";
					List<Double> boundingBox = null;
					if (node.has("boundingBox") && node.get("boundingBox").isArray()) {
						boundingBox = objectMapper.convertValue(
								node.get("boundingBox"), new TypeReference<List<Double>>() {}
						);
					}
					findings.add(new Finding(label, confidence, description, boundingBox));
				}
				return findings;
			}
			return List.of();
		} catch (Exception e) {
			log.warn("Failed to parse findings from response: {}", e.getMessage());
			return List.of();
		}
	}

	private String extractModelVersion(String json) {
		if (json == null || json.isBlank()) return "unknown";
		try {
			JsonNode root = objectMapper.readTree(json);
			if (root.has("modelVersion")) return root.get("modelVersion").asText("unknown");
			if (root.has("model_version")) return root.get("model_version").asText("unknown");
			return "unknown";
		} catch (Exception e) {
			return "unknown";
		}
	}

	private long extractProcessingTimeMs(String json) {
		if (json == null || json.isBlank()) return 0;
		try {
			JsonNode root = objectMapper.readTree(json);
			if (root.has("processingTimeMs")) return root.get("processingTimeMs").asLong(0);
			if (root.has("processing_time_ms")) return root.get("processing_time_ms").asLong(0);
			return 0;
		} catch (Exception e) {
			return 0;
		}
	}
}
