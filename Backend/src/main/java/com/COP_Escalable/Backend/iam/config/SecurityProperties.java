package com.COP_Escalable.Backend.iam.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(
		String issuer,
		Jwt jwt
) {
	public record Jwt(
			String keyId,
			String rsaPrivateKeyPem,
			String rsaPublicKeyPem
	) {}
}

