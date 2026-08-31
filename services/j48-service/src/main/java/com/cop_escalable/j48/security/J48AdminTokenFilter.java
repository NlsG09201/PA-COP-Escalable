package com.cop_escalable.j48.security;

import com.cop_escalable.j48.config.J48Properties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class J48AdminTokenFilter extends OncePerRequestFilter {
  public static final String ADMIN_TOKEN_HEADER = "X-J48-Admin-Token";

  private final J48Properties props;

  public J48AdminTokenFilter(J48Properties props) {
    this.props = props;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
    throws ServletException, IOException {
    if (!isTrainRequest(request)) {
      chain.doFilter(request, response);
      return;
    }

    String configuredToken = props.adminToken() == null ? "" : props.adminToken().trim();
    boolean tokenRequired = props.requireAdminToken() || !configuredToken.isEmpty();
    if (!tokenRequired) {
      chain.doFilter(request, response);
      return;
    }

    String providedToken = request.getHeader(ADMIN_TOKEN_HEADER);
    if (providedToken == null || providedToken.isBlank()) {
      writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing J48 admin token");
      return;
    }
    if (!configuredToken.equals(providedToken)) {
      writeError(response, HttpServletResponse.SC_FORBIDDEN, "Invalid J48 admin token");
      return;
    }

    chain.doFilter(request, response);
  }

  private boolean isTrainRequest(HttpServletRequest request) {
    return "POST".equalsIgnoreCase(request.getMethod()) && "/train".equals(request.getRequestURI());
  }

  private void writeError(HttpServletResponse response, int status, String message) throws IOException {
    response.setStatus(status);
    response.setHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
    response.getWriter().write("""
      {"status":%d,"error":"%s","message":"%s"}
      """.formatted(status, status == 401 ? "Unauthorized" : "Forbidden", message));
  }
}
