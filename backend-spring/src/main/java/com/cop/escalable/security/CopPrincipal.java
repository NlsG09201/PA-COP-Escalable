package com.cop.escalable.security;
import java.util.List;
public record CopPrincipal(String username, String userId, String organizationId, String siteId, List<String> roles) {}
