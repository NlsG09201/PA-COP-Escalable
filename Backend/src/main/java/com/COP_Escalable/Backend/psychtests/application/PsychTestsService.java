package com.COP_Escalable.Backend.psychtests.application;

import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.psychtests.domain.TestSubmission;
import com.COP_Escalable.Backend.psychtests.domain.TestTemplate;
import com.COP_Escalable.Backend.psychtests.infrastructure.TestSubmissionRepository;
import com.COP_Escalable.Backend.psychtests.infrastructure.TestTemplateRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PsychTestsService {
	private final TestTemplateRepository templates;
	private final TestSubmissionRepository submissions;
	private final PatientRepository patients;

	public PsychTestsService(TestTemplateRepository templates, TestSubmissionRepository submissions, PatientRepository patients) {
		this.templates = templates;
		this.submissions = submissions;
		this.patients = patients;
	}

	@Transactional(readOnly = true)
	public List<TestTemplate> listTemplates() {
		var tenant = TenantContextHolder.require();
		return templates.findAllByOrganizationId(tenant.organizationId()).stream().filter(TestTemplate::isActive).toList();
	}

	@Transactional
	public TestTemplate createTemplate(String code, String name, List<TestTemplate.Question> questions) {
		var tenant = TenantContextHolder.require();
		return templates.save(new TestTemplate(tenant.organizationId(), code, name, questions));
	}

	@Transactional
	public TestSubmission submit(UUID patientId, UUID templateId, CopUserPrincipal author, Map<String, String> answers) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		patients.findByIdAndOrganizationId(patientId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));
		templates.findByIdAndOrganizationId(templateId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Template not found in tenant"));
		return submissions.save(new TestSubmission(tenant.organizationId(), tenant.siteId(), patientId, templateId, author.userId(), author.getUsername(), answers));
	}

	@Transactional(readOnly = true)
	public List<TestSubmission> listSubmissions(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		return submissions.findAllByOrganizationIdAndSiteIdAndPatientIdOrderBySubmittedAtDesc(tenant.organizationId(), tenant.siteId(), patientId);
	}
}

