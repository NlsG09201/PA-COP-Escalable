package com.COP_Escalable.Backend.notifications.api;

import com.COP_Escalable.Backend.notifications.application.MedicalAlertSiteContactService;
import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.MedicalAlertSiteContact;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications/medical-alert-contacts")
public class MedicalAlertSiteContactController {
	private final MedicalAlertSiteContactService service;

	public MedicalAlertSiteContactController(MedicalAlertSiteContactService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','MEDICO','PROFESSIONAL')")
	public List<MedicalAlertSiteContact> list() {
		return service.listForCurrentSite();
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public MedicalAlertSiteContact create(@Valid @RequestBody UpsertMedicalAlertContactRequest req) {
		return service.create(req.audience(), req.channel(), req.address(), req.label());
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public MedicalAlertSiteContact update(
			@PathVariable UUID id,
			@Valid @RequestBody UpsertMedicalAlertContactRequest req
	) {
		return service.update(id, req.audience(), req.channel(), req.address(), req.label());
	}

	@DeleteMapping("/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public void delete(@PathVariable UUID id) {
		service.delete(id);
	}

	@GetMapping("/by-site/{siteId}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')")
	public List<MedicalAlertSiteContact> listBySite(@PathVariable UUID siteId) {
		return service.listForOrganizationSite(siteId);
	}

	@PostMapping("/by-site/{siteId}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')")
	public MedicalAlertSiteContact createBySite(
			@PathVariable UUID siteId,
			@Valid @RequestBody UpsertMedicalAlertContactRequest req
	) {
		return service.createForOrganizationSite(siteId, req.audience(), req.channel(), req.address(), req.label());
	}

	@PutMapping("/by-site/{siteId}/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')")
	public MedicalAlertSiteContact updateBySite(
			@PathVariable UUID siteId,
			@PathVariable UUID id,
			@Valid @RequestBody UpsertMedicalAlertContactRequest req
	) {
		return service.updateForOrganizationSite(siteId, id, req.audience(), req.channel(), req.address(), req.label());
	}

	@DeleteMapping("/by-site/{siteId}/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')")
	public void deleteBySite(@PathVariable UUID siteId, @PathVariable UUID id) {
		service.deleteForOrganizationSite(siteId, id);
	}

	public record UpsertMedicalAlertContactRequest(
			@NotNull AlertAudience audience,
			@NotNull NotificationDelivery.Channel channel,
			@NotNull String address,
			String label
	) {}
}
