package com.cop.escalable.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwt;
  public JwtAuthenticationFilter(JwtService jwt) { this.jwt = jwt; }
  @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) try {
      Claims c = jwt.parse(header.substring(7));
      List<String> roles = c.get("roles", List.class);
      var authorities = roles == null ? List.<SimpleGrantedAuthority>of() : roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
      var principal = new CopPrincipal(c.getSubject(), String.valueOf(c.get("user_id")), String.valueOf(c.get("organization_id")), blankToNull(String.valueOf(c.get("site_id"))), roles == null ? List.of() : roles);
      SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
    } catch (RuntimeException ignored) { SecurityContextHolder.clearContext(); }
    chain.doFilter(request, response);
  }
  private String blankToNull(String s) { return s == null || s.isBlank() || "null".equals(s) ? null : s; }
}
