package com.cop_escalable.j48.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.cop_escalable.j48.config.J48Properties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class J48AdminTokenFilterTest {
  @Test
  void skipsNonTrainRequests() throws ServletException, IOException {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    J48AdminTokenFilter filter = new J48AdminTokenFilter(props);
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/info");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(request, response);
    assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
  }

  @Test
  void rejectsTrainRequestWithoutToken() throws ServletException, IOException {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    J48AdminTokenFilter filter = new J48AdminTokenFilter(props);
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/train");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
    assertThat(response.getContentAsString()).contains("Missing J48 admin token");
    verifyNoInteractions(chain);
  }

  @Test
  void rejectsTrainRequestWithWrongToken() throws ServletException, IOException {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    J48AdminTokenFilter filter = new J48AdminTokenFilter(props);
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/train");
    request.addHeader(J48AdminTokenFilter.ADMIN_TOKEN_HEADER, "wrong-token");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
    assertThat(response.getContentAsString()).contains("Invalid J48 admin token");
    verifyNoInteractions(chain);
  }

  @Test
  void acceptsTrainRequestWithValidToken() throws ServletException, IOException {
    J48Properties props = new J48Properties(
        "/tmp/test.arff",
        "/tmp/test.model",
        true,
        "admin-token",
        true,
        true,
        "http://localhost:4200"
    );
    J48AdminTokenFilter filter = new J48AdminTokenFilter(props);
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/train");
    request.addHeader(J48AdminTokenFilter.ADMIN_TOKEN_HEADER, "admin-token");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(request, response);
    assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
  }
}
