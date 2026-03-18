package com.COP_Escalable.Backend.tenancy.api;

import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/public")
public class PublicTenancyController {
	private final SiteRepository sites;

	public PublicTenancyController(SiteRepository sites) {
		this.sites = sites;
	}

	@GetMapping("/sites")
	public List<SiteDto> listSites() {
		return sites.findAll().stream()
				.filter(site -> site.getStatus() == com.COP_Escalable.Backend.tenancy.domain.SiteStatus.ACTIVE)
				.map(s -> new SiteDto(
				s.getId(),
				s.getOrganizationId(),
				s.getName(),
				s.getTimezone(),
				s.getStatus().name()
		)).toList();
	}

	public record SiteDto(
			UUID id,
			UUID organizationId,
			String name,
			String timezone,
			String status
	) {}
}

