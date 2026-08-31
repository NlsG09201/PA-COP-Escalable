package com.cop.escalable.patients;

import com.cop.escalable.patients.dto.CreatePatientRequest;
import com.cop.escalable.security.CopPrincipal;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/patients")
public class PatientController {
  private final PatientService patients;
  public PatientController(PatientService patients) { this.patients = patients; }
  @GetMapping @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','MEDICO','PROFESSIONAL','SUPER_ADMIN','ODONTOLOGO','PSICOLOGO')")
  Map<String, Object> list(@AuthenticationPrincipal CopPrincipal principal, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size, @RequestParam(required = false) String search) { return patients.page(principal, page, size, search); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
  Map<String, Object> create(@AuthenticationPrincipal CopPrincipal principal, @Valid @RequestBody CreatePatientRequest request) { return patients.create(request, principal); }
}
