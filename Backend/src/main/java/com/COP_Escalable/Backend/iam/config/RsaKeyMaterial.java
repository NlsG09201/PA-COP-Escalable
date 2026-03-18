package com.COP_Escalable.Backend.iam.config;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

final class RsaKeyMaterial {
	private RsaKeyMaterial() {}

	static KeyPair resolveOrGenerate(SecurityProperties props) {
		var jwt = props.jwt();
		if (jwt != null && jwt.rsaPrivateKeyPem() != null && !jwt.rsaPrivateKeyPem().isBlank()
				&& jwt.rsaPublicKeyPem() != null && !jwt.rsaPublicKeyPem().isBlank()) {
			return fromPem(jwt.rsaPrivateKeyPem(), jwt.rsaPublicKeyPem());
		}
		return generate();
	}

	static KeyPair generate() {
		try {
			KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
			generator.initialize(2048);
			return generator.generateKeyPair();
		} catch (Exception e) {
			throw new IllegalStateException("Failed to generate RSA keypair", e);
		}
	}

	static KeyPair fromPem(String privatePem, String publicPem) {
		try {
			var privateBytes = parsePem(privatePem);
			var publicBytes = parsePem(publicPem);
			var kf = KeyFactory.getInstance("RSA");
			RSAPrivateKey privateKey = (RSAPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(privateBytes));
			RSAPublicKey publicKey = (RSAPublicKey) kf.generatePublic(new X509EncodedKeySpec(publicBytes));
			return new KeyPair(publicKey, privateKey);
		} catch (Exception e) {
			throw new IllegalArgumentException("Invalid RSA PEM material", e);
		}
	}

	private static byte[] parsePem(String pem) {
		var normalized = pem
				.replace("-----BEGIN PRIVATE KEY-----", "")
				.replace("-----END PRIVATE KEY-----", "")
				.replace("-----BEGIN PUBLIC KEY-----", "")
				.replace("-----END PUBLIC KEY-----", "")
				.replaceAll("\\s", "");
		return Base64.getDecoder().decode(normalized);
	}
}

