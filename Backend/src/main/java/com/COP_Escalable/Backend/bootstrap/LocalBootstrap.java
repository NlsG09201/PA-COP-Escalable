package com.COP_Escalable.Backend.bootstrap;

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

	private static void ensureRole(UserRoleRepository repo, java.util.UUID userId, Role role) {
		var key = new UserRoleAssignment.Key(userId, role);
		if (!repo.existsById(key)) {
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

