package com.COP_Escalable.Backend.shared.tenancy;

import java.util.UUID;

public record TenantContext(
		UUID organizationId,
		UUID siteId
) {
	public TenantContext {
		if (organizationId == null) {
			throw new IllegalArgumentException("organizationId is required");
		}
	}
}

