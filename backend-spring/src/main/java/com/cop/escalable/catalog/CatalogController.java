package com.cop.escalable.catalog;

import com.cop.escalable.catalog.dto.ServiceRequest;
import com.cop.escalable.security.CopPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/services")
public class CatalogController {
  private final CatalogService catalog;
  public CatalogController(CatalogService catalog) { this.catalog = catalog; }
  @GetMapping @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','MEDICO','PROFESSIONAL')") List<Map<String, Object>> list(@AuthenticationPrincipal CopPrincipal principal) { return catalog.list(principal, null); }
  @GetMapping("/category/{category}") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','MEDICO','PROFESSIONAL')") List<Map<String, Object>> category(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String category) { return catalog.list(principal, "PSICOLOGIA".equalsIgnoreCase(category) ? "PSICOLOGIA" : "ODONTOLOGIA"); }
  @PostMapping @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')") Map<String, Object> create(@AuthenticationPrincipal CopPrincipal principal, @Valid @RequestBody ServiceRequest request) { return catalog.create(principal, request); }
  @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')") Map<String, Object> update(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String id, @Valid @RequestBody ServiceRequest request) { return catalog.update(principal, id, request); }
  @PutMapping("/{id}/status") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')") Map<String, Object> status(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String id, @RequestBody Map<String, Boolean> body) { return catalog.status(principal, id, Boolean.TRUE.equals(body.get("active"))); }
  @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN')") Map<String, Object> delete(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String id) { return catalog.remove(principal, id); }
}
