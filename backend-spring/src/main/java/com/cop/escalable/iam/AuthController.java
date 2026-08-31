package com.cop.escalable.iam;

import com.cop.escalable.iam.dto.LoginRequest;
import com.cop.escalable.iam.dto.RefreshRequest;
import com.cop.escalable.iam.dto.TokenResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/auth")
public class AuthController {
  private final IamService iam;
  public AuthController(IamService iam) { this.iam = iam; }
  @PostMapping("/login") TokenResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) { return iam.login(request.username(), request.password(), request.siteId(), http.getRemoteAddr(), http.getHeader("User-Agent")); }
  @PostMapping("/refresh") TokenResponse refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) { return iam.refresh(request.refreshToken(), http.getRemoteAddr(), http.getHeader("User-Agent")); }
  @org.springframework.web.bind.annotation.ExceptionHandler(BadCredentialsException.class) @ResponseStatus(HttpStatus.UNAUTHORIZED) java.util.Map<String, Object> unauthorized() { return java.util.Map.of("statusCode", 401, "message", "Invalid credentials"); }
}
