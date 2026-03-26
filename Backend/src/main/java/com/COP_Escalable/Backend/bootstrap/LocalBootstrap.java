package com.COP_Escalable.Backend.bootstrap;

import com.COP_Escalable.Backend.catalog.domain.CatalogServiceItem;
import com.COP_Escalable.Backend.catalog.domain.ServiceCategory;
import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import com.COP_Escalable.Backend.catalog.infrastructure.CatalogServiceItemRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceCategoryRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceOfferingRepository;
import com.COP_Escalable.Backend.iam.domain.Role;
import com.COP_Escalable.Backend.iam.domain.UserAccount;
import com.COP_Escalable.Backend.iam.domain.UserRoleAssignment;
import com.COP_Escalable.Backend.iam.infrastructure.UserAccountRepository;
import com.COP_Escalable.Backend.iam.infrastructure.UserRoleRepository;
import com.COP_Escalable.Backend.tenancy.domain.Organization;
import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.Site;
import com.COP_Escalable.Backend.tenancy.infrastructure.OrganizationRepository;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import com.COP_Escalable.Backend.therapy.infrastructure.TherapyModuleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

@Configuration
@Profile("local")
public class LocalBootstrap {

	@Bean
	CommandLineRunner bootstrapLocal(
			OrganizationRepository organizations,
			SiteRepository sites,
			ProfessionalRepository professionals,
			UserAccountRepository users,
			UserRoleRepository roles,
			TherapyModuleRepository therapyModules,
			ServiceCategoryRepository serviceCategories,
			CatalogServiceItemRepository catalogServices,
			ServiceOfferingRepository serviceOfferings,
			PasswordEncoder passwordEncoder
	) {
		return args -> {
			String adminUsername = requireEnv("APP_BOOTSTRAP_ADMIN_USERNAME");
			String adminPassword = requireEnv("APP_BOOTSTRAP_ADMIN_PASSWORD");

			Organization org = organizations.findAll().stream().findFirst().orElseGet(() -> organizations.save(new Organization("COP Demo Org")));
			Site site = sites.findAllByOrganizationId(org.getId()).stream().findFirst()
					.orElseGet(() -> sites.save(new Site(org.getId(), "Sede Principal", "America/Bogota")));

			Optional<UserAccount> existing = users.findByOrganizationIdAndUsername(org.getId(), adminUsername.trim().toLowerCase());
			UserAccount admin = existing.orElseGet(() -> new UserAccount(
					org.getId(),
					adminUsername,
					passwordEncoder.encode(adminPassword)
			));
			admin.setPasswordHash(passwordEncoder.encode(adminPassword));
			admin = users.save(admin);

			ensureRole(roles, admin.getId(), Role.ADMIN);
			ensureRole(roles, admin.getId(), Role.ORG_ADMIN);
			ensureRole(roles, admin.getId(), Role.SITE_ADMIN);
			seedProfessionals(professionals, org, site);
			seedTherapyModules(therapyModules);
			seedCatalog(serviceCategories, catalogServices, serviceOfferings, org, site);
			// Site selection is handled at app layer; bootstrap creates one site for convenience.
		};
	}

	private static void seedProfessionals(ProfessionalRepository professionals, Organization org, Site site) {
		if (!professionals.findAllByOrganizationId(org.getId()).isEmpty()) {
			return;
		}
		professionals.save(new Professional(org.getId(), site.getId(), "Dra. Paula Ramirez", "Odontologia general"));
		professionals.save(new Professional(org.getId(), site.getId(), "Dr. Mateo Suarez", "Psicologia clinica"));
	}

	private static void seedCatalog(
			ServiceCategoryRepository categories,
			CatalogServiceItemRepository catalogItems,
			ServiceOfferingRepository offerings,
			Organization org,
			Site site
	) {
		if (categories.existsByOrganizationId(org.getId())) {
			return;
		}

		ServiceCategory dental = categories.save(ServiceCategory.create(
				org.getId(), "odontologia", "Odontología", "Servicios de salud oral y diagnóstico", 1));
		ServiceCategory psych = categories.save(ServiceCategory.create(
				org.getId(), "psicologia", "Psicología", "Salud mental, evaluación y seguimiento", 2));

		CatalogServiceItem dConsulta = catalogItems.save(CatalogServiceItem.create(
				org.getId(), dental, "consulta-odontologica",
				"Consulta odontológica general",
				"Valoración clínica, plan de tratamiento y recomendaciones preventivas.",
				45, "odontologia odonto dental caries"));
		CatalogServiceItem dLimpieza = catalogItems.save(CatalogServiceItem.create(
				org.getId(), dental, "limpieza-profilaxis",
				"Limpieza y profilaxis",
				"Eliminación de placa bacteriana y sarro; pulido dental.",
				60, "profilaxis limpieza higiene"));

		CatalogServiceItem pConsulta = catalogItems.save(CatalogServiceItem.create(
				org.getId(), psych, "consulta-psicologica-inicial",
				"Consulta psicológica inicial",
				"Entrevista clínica, historia y orientación terapéutica.",
				50, "psicologia psicologo terapia ansiedad"));
		CatalogServiceItem pSeg = catalogItems.save(CatalogServiceItem.create(
				org.getId(), psych, "sesion-seguimiento",
				"Sesión de seguimiento",
				"Sesión terapéutica de continuidad.",
				50, "seguimiento terapia emocional"));

		offerings.save(ServiceOffering.create(
				org.getId(), site.getId(), dConsulta,
				"Consulta odontológica",
				"Diagnóstico y plan de tratamiento.",
				null, 120_000L, null, "COP", null, null));
		offerings.save(ServiceOffering.create(
				org.getId(), site.getId(), dLimpieza,
				"Limpieza dental",
				"Profilaxis completa.",
				null, 95_000L, null, "COP", null, null));
		offerings.save(ServiceOffering.create(
				org.getId(), site.getId(), pConsulta,
				"Consulta psicológica",
				"Primera valoración con enfoque clínico.",
				null, 110_000L, null, "COP", null, null));
		offerings.save(ServiceOffering.create(
				org.getId(), site.getId(), pSeg,
				"Sesión psicológica",
				"Seguimiento terapéutico.",
				null, 95_000L, null, "COP", null, null));
	}

	private static void seedTherapyModules(TherapyModuleRepository therapyModules) {
		if (!therapyModules.findAll().isEmpty()) {
			return;
		}

		therapyModules.save(new TherapyModuleEntity(
				"BREATHING_101",
				"Respiración 4-7-8",
				"Ejercicio breve para reducir ansiedad y estrés.",
				"BREATHING",
				"BEGINNER",
				6,
				"""
				{"type":"breathing","pattern":{"inhale":4,"hold":7,"exhale":8},"rounds":4}
				""".trim()
		));

		therapyModules.save(new TherapyModuleEntity(
				"MINDFULNESS_101",
				"Atención plena (5-4-3-2-1)",
				"Técnica sensorial para anclarse al presente.",
				"MINDFULNESS",
				"BEGINNER",
				8,
				"""
				{"type":"grounding","steps":["5 cosas que ves","4 cosas que sientes","3 cosas que oyes","2 cosas que hueles","1 cosa que saboreas"]}
				""".trim()
		));

		therapyModules.save(new TherapyModuleEntity(
				"JOURNALING_101",
				"Diario guiado",
				"Reflexión corta para identificar pensamientos y emociones.",
				"JOURNALING",
				"BEGINNER",
				10,
				"""
				{"type":"journaling","prompts":["¿Qué siento ahora?","¿Qué lo detonó?","¿Qué necesito hoy?"]}
				""".trim()
		));

		therapyModules.save(new TherapyModuleEntity(
				"CBT_201",
				"Reestructuración cognitiva",
				"Identificar pensamiento automático y reformularlo.",
				"CBT",
				"INTERMEDIATE",
				12,
				"""
				{"type":"cbt","fields":["situacion","pensamiento","emocion","evidencia_a_favor","evidencia_en_contra","pensamiento_alternativo"]}
				""".trim()
		));

		therapyModules.save(new TherapyModuleEntity(
				"RELAX_101",
				"Relajación muscular",
				"Escaneo corporal y tensión-relajación.",
				"RELAXATION",
				"BEGINNER",
				9,
				"""
				{"type":"pmr","groups":["hombros","mandíbula","manos","abdomen","piernas"],"secondsPerGroup":10}
				""".trim()
		));
	}

	private static void ensureRole(UserRoleRepository repo, java.util.UUID userId, Role role) {
		String id = UserRoleAssignment.buildId(userId, role);
		if (!repo.existsById(id)) {
			repo.save(new UserRoleAssignment(userId, role));
		}
	}

	private static String requireEnv(String name) {
		String v = System.getenv(name);
		if (v == null || v.isBlank()) {
			throw new IllegalStateException("Missing env " + name);
		}
		return v;
	}
}

