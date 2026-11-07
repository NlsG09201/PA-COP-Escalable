package com.cop.escalable.appointments;

import com.cop.escalable.security.CopPrincipal;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/appointments")
public class AppointmentController {
  private final AppointmentService appointments;
  public AppointmentController(AppointmentService appointments) { this.appointments = appointments; }
  @GetMapping("/professionals") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MEDICO','PROFESSIONAL','ORG_ADMIN','SITE_ADMIN')") List<Map<String, Object>> professionals(@AuthenticationPrincipal CopPrincipal principal) { return appointments.professionals(principal); }
  @GetMapping @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')") Map<String, Object> list(@AuthenticationPrincipal CopPrincipal principal, @RequestParam(required = false) String from, @RequestParam(required = false) String to, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size, @RequestParam(required = false) String professionalId, @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean unassignedOnly) { return appointments.list(principal, from, to, page, size, professionalId, status, unassignedOnly); }
  @PostMapping @PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN')") Map<String, Object> create(@AuthenticationPrincipal CopPrincipal principal, @RequestBody Map<String, Object> body) { return appointments.create(principal, body); }
  @PatchMapping("/{id}/status") @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')") Map<String, Object> status(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String id, @RequestBody Map<String, Object> body) { return appointments.updateStatus(principal, id, String.valueOf(body.get("status"))); }
  @PatchMapping("/{id}/claim") @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MEDICO','PROFESSIONAL','ORG_ADMIN','SITE_ADMIN')") Map<String, Object> claim(@AuthenticationPrincipal CopPrincipal principal, @PathVariable String id, @RequestBody Map<String, @NotBlank String> body) { return appointments.claim(principal, id, body.get("professionalId")); }
}
