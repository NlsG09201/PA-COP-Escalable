package com.COP_Escalable.Backend.shared.tenancy;

import java.util.Optional;

public final class TenantContextHolder {
	private static final ThreadLocal<TenantContext> CTX = new ThreadLocal<>();

	private TenantContextHolder() {}

	public static Optional<TenantContext> get() {
		return Optional.ofNullable(CTX.get());
	}

	public static TenantContext require() {
		var ctx = CTX.get();
		if (ctx == null) {
			throw new TenantMissingException("Missing tenant context");
		}
		return ctx;
	}

	public static void set(TenantContext ctx) {
		CTX.set(ctx);
	}

	public static void clear() {
		CTX.remove();
	}
}

