package com.COP_Escalable.Backend.catalog.api;

import com.COP_Escalable.Backend.catalog.application.ManagedServiceView;
import com.COP_Escalable.Backend.catalog.application.ServiceCatalogCategory;
import com.COP_Escalable.Backend.catalog.application.ServiceCatalogManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/services")
public class ServiceManagementController {
	private final ServiceCatalogManagementService service;

	public ServiceManagementController(ServiceCatalogManagementService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL','MEDICO')")
	public List<ManagedServiceView> list(
			@RequestParam(required = false) String category,
			@RequestParam(required = false) Boolean active,
			@RequestParam(required = false, name = "q") String query
	) {
		return service.list(parseCategoryOrNull(category), active, query);
	}

	@GetMapping("/category/{category}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL','MEDICO')")
	public List<ManagedServiceView> byCategory(@PathVariable String category) {
		return service.list(ServiceCatalogCategory.parse(category), null, null);
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public ManagedServiceView create(@Valid @RequestBody UpsertServiceRequest req) {
		return service.create(new ServiceCatalogManagementService.CreateServiceCommand(
				req.name(),
				req.description(),
				ServiceCatalogCategory.parse(req.category()),
				req.price(),
				req.duration()
		));
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public ManagedServiceView update(@PathVariable UUID id, @Valid @RequestBody UpsertServiceRequest req) {
		return service.update(id, new ServiceCatalogManagementService.UpdateServiceCommand(
				req.name(),
				req.description(),
				ServiceCatalogCategory.parse(req.category()),
				req.price(),
				req.duration()
		));
	}

	@PutMapping("/{id}/status")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public ManagedServiceView setStatus(@PathVariable UUID id, @Valid @RequestBody ServiceStatusRequest req) {
		return service.setActive(id, req.active());
	}

	@DeleteMapping("/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN')")
	public void delete(@PathVariable UUID id) {
		service.delete(id);
	}

	private static ServiceCatalogCategory parseCategoryOrNull(String raw) {
		return (raw == null || raw.isBlank()) ? null : ServiceCatalogCategory.parse(raw);
	}

	public record UpsertServiceRequest(
			@NotBlank String name,
			String description,
			@NotBlank String category,
			@Min(0) long price,
			Integer duration
	) {}

	public record ServiceStatusRequest(@NotNull Boolean active) {}
}
