package com.COP_Escalable.Backend.shared.tenancy;

public class TenantMissingException extends RuntimeException {
	public TenantMissingException(String message) {
		super(message);
	}
}

