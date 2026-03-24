package com.COP_Escalable.Backend.aiassist.application;

import com.COP_Escalable.Backend.aiassist.domain.AiAssistSourceType;
import com.COP_Escalable.Backend.aiassist.domain.AiClinicalSuggestion;
import com.COP_Escalable.Backend.aiassist.domain.AiSuggestionStatus;
import com.COP_Escalable.Backend.aiassist.infrastructure.AiClinicalSuggestionRepository;
import com.COP_Escalable.Backend.clinical.application.ClinicalRecordService;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.psychtests.domain.TestSubmission;
import com.COP_Escalable.Backend.psychtests.domain.TestTemplate;
import com.COP_Escalable.Backend.psychtests.infrastructure.TestSubmissionRepository;
import com.COP_Escalable.Backend.psychtests.infrastructure.TestTemplateRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContext;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AiAssistService {

	private static final EnumSet<AiSuggestionStatus> TERMINAL_ASYNC_STATUSES = EnumSet.of(
			AiSuggestionStatus.PENDING_REVIEW,
			AiSuggestionStatus.APPROVED,
			AiSuggestionStatus.REJECTED,
			AiSuggestionStatus.FAILED
	);

	private final AiAssistProperties props;
	private final AiClinicalSuggestionRepository suggestions;
	private final TestSubmissionRepository submissions;
	private final TestTemplateRepository templates;
	private final PatientRepository patients;
	private final LlmCompletionClient llmCompletionClient;
	private final AiAssistPromptLoader promptLoader;
	private final ClinicalRecordService clinicalRecordService;
	private final ObjectMapper objectMapper;
	private final ApplicationEventPublisher eventPublisher;
	private final PsychometricLocalScoringService psychometricLocalScoringService;
	private final AiStructuredOutputSchemaValidator outputSchemaValidator;
	private final TransactionTemplate transactionTemplate;
	private final MongoOperations mongoOperations;

	public AiAssistService(
			AiAssistProperties props,
			AiClinicalSuggestionRepository suggestions,
			TestSubmissionRepository submissions,
			TestTemplateRepository templates,
			PatientRepository patients,
			LlmCompletionClient llmCompletionClient,
			AiAssistPromptLoader promptLoader,
			ClinicalRecordService clinicalRecordService,
			ObjectMapper objectMapper,
			ApplicationEventPublisher eventPublisher,
			PsychometricLocalScoringService psychometricLocalScoringService,
			AiStructuredOutputSchemaValidator outputSchemaValidator,
			PlatformTransactionManager transactionManager,
			MongoOperations mongoOperations
	) {
		this.props = props;
		this.suggestions = suggestions;
		this.submissions = submissions;
		this.templates = templates;
		this.patients = patients;
		this.llmCompletionClient = llmCompletionClient;
		this.promptLoader = promptLoader;
		this.clinicalRecordService = clinicalRecordService;
		this.objectMapper = objectMapper;
		this.eventPublisher = eventPublisher;
		this.psychometricLocalScoringService = psychometricLocalScoringService;
		this.outputSchemaValidator = outputSchemaValidator;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
		this.mongoOperations = mongoOperations;
	}

	public boolean useAsyncAnalyzeByDefault() {
		return props.isEnabled() && props.isAsync();
	}

	@Transactional
	public AiClinicalSuggestion enqueuePsychTestAnalysis(UUID patientId, UUID submissionId, Jwt jwt) {
		requireFeatureEnabled();
		var loaded = loadValidatedPsychContext(patientId, submissionId);
		UUID userId = requireUserId(jwt);
		String username = requireUsername(jwt);
		String modelLabel = props.getProvider() == AiAssistProperties.Provider.STUB ? "stub" : props.getModel();
		String scoringBlock = psychometricLocalScoringService.buildScoringBlockForPrompt(loaded.template(), loaded.submission().getAnswersByQuestionId());

		var queued = AiClinicalSuggestion.createQueuedPsychTest(
				loaded.orgId(),
				loaded.siteId(),
				patientId,
				submissionId,
				loaded.template().getId(),
				loaded.template().getCode(),
				modelLabel,
				props.getPromptVersion(),
				userId,
				username,
				scoringBlock
		);
		var saved = suggestions.save(queued);
		eventPublisher.publishEvent(new AiAssistAnalysisRequestedEvent(saved.getId()));
		return saved;
	}

	@Transactional
	public AiClinicalSuggestion analyzePsychTestSubmissionSync(UUID patientId, UUID submissionId, Jwt jwt) {
		requireFeatureEnabled();
		var loaded = loadValidatedPsychContext(patientId, submissionId);
		UUID userId = requireUserId(jwt);
		String username = requireUsername(jwt);
		String modelLabel = props.getProvider() == AiAssistProperties.Provider.STUB ? "stub" : props.getModel();
		String scoringBlock = psychometricLocalScoringService.buildScoringBlockForPrompt(loaded.template(), loaded.submission().getAnswersByQuestionId());

		String systemPrompt = promptLoader.loadSystemPrompt();
		String userPrompt = buildUserPrompt(loaded.template(), loaded.submission(), scoringBlock);

		String raw;
		try {
			raw = llmCompletionClient.complete(systemPrompt, userPrompt);
		} catch (Exception e) {
			return suggestions.save(new AiClinicalSuggestion(
					loaded.orgId(),
					loaded.siteId(),
					patientId,
					AiAssistSourceType.PSYCH_TEST_SUBMISSION,
					submissionId,
					loaded.template().getId(),
					loaded.template().getCode(),
					modelLabel,
					props.getPromptVersion(),
					AiSuggestionStatus.FAILED,
					e.getMessage(),
					"",
					"unknown",
					true,
					"Fallo al invocar el modelo",
					"{}",
					userId,
					username,
					scoringBlock
			));
		}

		try {
			ParsedAssistOutput parsed = parseAndValidateModelJson(raw);
			var saved = suggestions.save(new AiClinicalSuggestion(
					loaded.orgId(),
					loaded.siteId(),
					patientId,
					AiAssistSourceType.PSYCH_TEST_SUBMISSION,
					submissionId,
					loaded.template().getId(),
					loaded.template().getCode(),
					modelLabel,
					props.getPromptVersion(),
					AiSuggestionStatus.PENDING_REVIEW,
					raw,
					parsed.fingerprint(),
					parsed.risk(),
					parsed.humanReviewRequired(),
					parsed.headline(),
					parsed.structuredJson(),
					userId,
					username,
					scoringBlock
			));
			maybeCriticalAlert(saved, jwt);
			return saved;
		} catch (Exception e) {
			return suggestions.save(new AiClinicalSuggestion(
					loaded.orgId(),
					loaded.siteId(),
					patientId,
					AiAssistSourceType.PSYCH_TEST_SUBMISSION,
					submissionId,
					loaded.template().getId(),
					loaded.template().getCode(),
					modelLabel,
					props.getPromptVersion(),
					AiSuggestionStatus.FAILED,
					raw,
					"",
					"unknown",
					true,
					"No se pudo validar o interpretar la salida del modelo",
					"{}",
					userId,
					username,
					scoringBlock
			));
		}
	}

	public void processQueuedPsychTestAnalysis(UUID suggestionId) {
		var rowOpt = suggestions.findById(suggestionId);
		if (rowOpt.isEmpty()) {
			return;
		}
		if (TERMINAL_ASYNC_STATUSES.contains(rowOpt.get().getStatus())) {
			return;
		}

		boolean claimed = mongoOperations.updateFirst(
				Query.query(Criteria.where("id").is(suggestionId).and("status").is(AiSuggestionStatus.QUEUED)),
				Update.update("status", AiSuggestionStatus.PROCESSING),
				AiClinicalSuggestion.class
		).getModifiedCount() > 0;

		if (!claimed) {
			return;
		}

		var processing = suggestions.findById(suggestionId).orElseThrow();
		TenantContextHolder.set(new TenantContext(processing.getOrganizationId(), processing.getSiteId()));
		try {
			var submission = submissions.findById(processing.getPsychTestSubmissionId()).orElse(null);
			var template = templates.findById(processing.getPsychTestTemplateId()).orElse(null);
			if (submission == null || template == null) {
				failProcessing(suggestionId, "Submission o plantilla no encontrados", "{}");
				return;
			}

			String systemPrompt = promptLoader.loadSystemPrompt();
			String scoringBlock = processing.getDeterministicScoringSummary() != null
					? processing.getDeterministicScoringSummary()
					: psychometricLocalScoringService.buildScoringBlockForPrompt(template, submission.getAnswersByQuestionId());
			String userPrompt = buildUserPrompt(template, submission, scoringBlock);

			String raw;
			try {
				raw = llmCompletionClient.complete(systemPrompt, userPrompt);
			} catch (Exception e) {
				failProcessing(suggestionId, e.getMessage(), "{}");
				return;
			}

			try {
				ParsedAssistOutput parsed = parseAndValidateModelJson(raw);
				UUID sid = suggestionId;
				transactionTemplate.executeWithoutResult(status -> {
					var fresh = suggestions.findById(sid).orElse(null);
					if (fresh != null && fresh.getStatus() == AiSuggestionStatus.PROCESSING) {
						fresh.applyAnalysisSuccess(
								raw,
								parsed.fingerprint(),
								parsed.risk(),
								parsed.humanReviewRequired(),
								parsed.headline(),
								parsed.structuredJson()
						);
						suggestions.save(fresh);
					}
				});
				if (props.isAlertOnCritical() && "critical".equals(parsed.risk())
						&& processing.getRequestedByUserId() != null && processing.getRequestedByUsername() != null) {
					clinicalRecordService.createMedicalAlert(
							processing.getPatientId(),
							processing.getRequestedByUserId(),
							processing.getRequestedByUsername(),
							"IA: señal de riesgo crítico (revisión urgente)",
							"El asistente de IA marcó risk_level=critical para la sugerencia " + suggestionId
									+ ". Esto no sustituye evaluación clínica; revisar de inmediato.",
							"CRITICAL"
					);
				}
			} catch (Exception e) {
				failProcessing(suggestionId, raw, "{}");
			}
		} finally {
			TenantContextHolder.clear();
		}
	}

	private void failProcessing(UUID suggestionId, String rawOrMessage, String structuredFallback) {
		UUID sid = suggestionId;
		transactionTemplate.executeWithoutResult(status -> {
			var fresh = suggestions.findById(sid).orElse(null);
			if (fresh != null && fresh.getStatus() == AiSuggestionStatus.PROCESSING) {
				fresh.applyAnalysisFailure(rawOrMessage, "No se pudo validar o interpretar la salida del modelo", structuredFallback);
				suggestions.save(fresh);
			}
		});
	}

	private ParsedAssistOutput parseAndValidateModelJson(String raw) throws JsonProcessingException {
		String json = AiJsonFence.unwrap(raw);
		JsonNode node = objectMapper.readTree(json);
		if (props.isValidateOutputSchema()) {
			outputSchemaValidator.validateOrThrow(node);
		}
		AiStructuredOutput parsed = objectMapper.treeToValue(node, AiStructuredOutput.class);
		String structuredJson = objectMapper.writeValueAsString(parsed);
		String fingerprint = sha256Hex(structuredJson);
		String risk = parsed.getRiskLevel() == null ? "medium" : parsed.getRiskLevel().trim().toLowerCase();
		boolean review = parsed.getHumanReviewRequired() == null || parsed.getHumanReviewRequired();
		String headline = buildHeadline(parsed);
		return new ParsedAssistOutput(structuredJson, fingerprint, risk, review, headline);
	}

	private void maybeCriticalAlert(AiClinicalSuggestion saved, Jwt jwt) {
		if (!props.isAlertOnCritical() || saved.getRiskLevel() == null || !"critical".equals(saved.getRiskLevel().trim().toLowerCase())) {
			return;
		}
		UUID reviewer = requireUserId(jwt);
		String uname = requireUsername(jwt);
		clinicalRecordService.createMedicalAlert(
				saved.getPatientId(),
				reviewer,
				uname,
				"IA: señal de riesgo crítico (revisión urgente)",
				"El asistente de IA marcó risk_level=critical para la sugerencia " + saved.getId()
						+ ". Esto no sustituye evaluación clínica; revisar de inmediato.",
				"CRITICAL"
		);
	}

	private record ParsedAssistOutput(String structuredJson, String fingerprint, String risk, boolean humanReviewRequired, String headline) {}

	private record LoadedPsychContext(UUID orgId, UUID siteId, TestSubmission submission, TestTemplate template) {}

	private LoadedPsychContext loadValidatedPsychContext(UUID patientId, UUID submissionId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("siteId is required in tenant context");
		}
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		patients.findByIdAndOrganizationId(patientId, orgId)
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));

		var submission = submissions.findById(submissionId)
				.orElseThrow(() -> new IllegalArgumentException("Submission not found"));
		if (!orgId.equals(submission.getOrganizationId()) || !siteId.equals(submission.getSiteId()) || !patientId.equals(submission.getPatientId())) {
			throw new IllegalArgumentException("Submission not found");
		}

		var template = templates.findByIdAndOrganizationId(submission.getTemplateId(), orgId)
				.orElseThrow(() -> new IllegalArgumentException("Template not found"));

		return new LoadedPsychContext(orgId, siteId, submission, template);
	}

	private String buildUserPrompt(TestTemplate template, TestSubmission submission, String scoringBlock) {
		String userTemplate = promptLoader.loadUserTemplate();
		String questionnaireBlock = buildQuestionnaireBlock(template, submission.getAnswersByQuestionId());
		return userTemplate
				.replace("{{LOCAL_SCORING_BLOCK}}", scoringBlock)
				.replace("{{QUESTIONNAIRE_BLOCK}}", questionnaireBlock);
	}

	@Transactional(readOnly = true)
	public AiClinicalSuggestion latestForPatient(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("siteId is required in tenant context");
		}
		patients.findByIdAndOrganizationId(patientId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));
		return suggestions.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(),
				tenant.siteId(),
				patientId
		).orElseThrow(() -> new IllegalArgumentException("No suggestions for patient"));
	}

	@Transactional(readOnly = true)
	public AiClinicalSuggestion getSuggestion(UUID patientId, UUID suggestionId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("siteId is required in tenant context");
		}
		patients.findByIdAndOrganizationId(patientId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));
		var s = suggestions.findByIdAndOrganizationIdAndSiteId(suggestionId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Suggestion not found"));
		if (!patientId.equals(s.getPatientId())) {
			throw new IllegalArgumentException("Suggestion not found");
		}
		return s;
	}

	@Transactional
	public AiClinicalSuggestion approve(UUID suggestionId, Jwt jwt, String note) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("siteId is required in tenant context");
		}
		var s = suggestions.findByIdAndOrganizationIdAndSiteId(suggestionId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Suggestion not found"));
		if (s.getStatus() != AiSuggestionStatus.PENDING_REVIEW) {
			throw new IllegalStateException("Suggestion is not pending review");
		}
		UUID reviewer = requireUserId(jwt);
		String uname = requireUsername(jwt);
		String trimmedNote = note == null ? "" : note.trim();
		s.markApproved(reviewer, uname, trimmedNote);

		String clinicalNote = "[AI_ASSIST approved id=" + s.getId() + "]\n"
				+ (s.getHeadline() == null ? "" : s.getHeadline())
				+ (trimmedNote.isEmpty() ? "" : "\nNota del profesional: " + trimmedNote);
		clinicalRecordService.addEntry(s.getPatientId(), reviewer, uname, "AI_ASSIST_REVIEWED", clinicalNote);

		return suggestions.save(s);
	}

	@Transactional
	public AiClinicalSuggestion reject(UUID suggestionId, Jwt jwt, String reason) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("siteId is required in tenant context");
		}
		var s = suggestions.findByIdAndOrganizationIdAndSiteId(suggestionId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Suggestion not found"));
		if (s.getStatus() != AiSuggestionStatus.PENDING_REVIEW) {
			throw new IllegalStateException("Suggestion is not pending review");
		}
		UUID reviewer = requireUserId(jwt);
		String uname = requireUsername(jwt);
		String trimmed = reason == null ? "" : reason.trim();
		s.markRejected(reviewer, uname, trimmed);
		return suggestions.save(s);
	}

	private void requireFeatureEnabled() {
		if (!props.isEnabled()) {
			throw new IllegalStateException("AI assist is disabled");
		}
	}

	private static String buildQuestionnaireBlock(TestTemplate template, java.util.Map<String, String> answers) {
		StringBuilder sb = new StringBuilder();
		sb.append("Instrumento: ").append(template.getName()).append(" (code=").append(template.getCode()).append(")\n");
		for (var q : template.getQuestions()) {
			String qid = q.id();
			String ans = answers.getOrDefault(qid, "");
			sb.append("- Pregunta [").append(qid).append("]: ").append(q.prompt()).append("\n");
			sb.append("  Respuesta: ").append(ans).append("\n");
		}
		return sb.toString();
	}

	private static String buildHeadline(AiStructuredOutput parsed) {
		if (parsed.getCandidateConditions() != null && !parsed.getCandidateConditions().isEmpty()) {
			var first = parsed.getCandidateConditions().get(0);
			if (first.getLabel() != null && !first.getLabel().isBlank()) {
				return first.getLabel().trim();
			}
		}
		return "Asistencia IA — revisión requerida";
	}

	private static String sha256Hex(String s) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			byte[] hash = md.digest(s.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		} catch (Exception e) {
			return "unhashed";
		}
	}

	private static UUID requireUserId(Jwt jwt) {
		String claim = jwt != null ? jwt.getClaimAsString("user_id") : null;
		if (claim == null || claim.isBlank()) {
			throw new IllegalArgumentException("Missing user_id claim");
		}
		return UUID.fromString(claim);
	}

	private static String requireUsername(Jwt jwt) {
		String sub = jwt != null ? jwt.getSubject() : null;
		if (sub == null || sub.isBlank()) {
			throw new IllegalArgumentException("Missing subject claim");
		}
		return sub;
	}
}
