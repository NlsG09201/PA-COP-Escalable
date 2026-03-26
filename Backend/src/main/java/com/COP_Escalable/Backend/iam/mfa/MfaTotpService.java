package com.COP_Escalable.Backend.iam.mfa;

import com.COP_Escalable.Backend.iam.domain.UserAccount;
import com.COP_Escalable.Backend.iam.infrastructure.UserAccountRepository;
import com.COP_Escalable.Backend.iam.service.TokenService;
import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import com.COP_Escalable.Backend.iam.service.PrincipalService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Minimal RFC6238 TOTP (SHA-1, 30s, 6 digits) with AES-GCM encrypted secret at rest.
 */
@Service
public class MfaTotpService {

	private static final int SECRET_BYTES = 20;
	private static final int TOTP_STEP_SECONDS = 30;
	private static final int TOTP_DIGITS = 6;
	private static final int TOTP_WINDOW_STEPS = 1; // +/- 1 step

	private static final Pattern CODE_6_DIGITS = Pattern.compile("^\\d{6}$");

	private final UserAccountRepository users;
	private final TokenService tokens;
	private final PrincipalService principals;

	private final byte[] aesKey;
	private final String issuer;

	public MfaTotpService(UserAccountRepository users, TokenService tokens, PrincipalService principals) {
		this.users = users;
		this.tokens = tokens;
		this.principals = principals;
		this.aesKey = readAesKey();
		this.issuer = System.getenv().getOrDefault("APP_SECURITY_MFA_ISSUER", "COP");
	}

	private static byte[] readAesKey() {
		String b64 = System.getenv().getOrDefault("APP_SECURITY_MFA_AES_KEY_BASE64", "");
		if (b64.isBlank()) {
			return null; // MFA setup will fail fast when attempted.
		}
		return Base64.getDecoder().decode(b64);
	}

	@Transactional
	public MfaSetupStartResponse startSetup(UUID userId) {
		requireEncryptionConfigured();
		UserAccount user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

		byte[] secret = randomBytes(SECRET_BYTES);
		String secretBase32 = base32Encode(secret);
		String enc = encryptBase32Secret(secret);

		user.setMfaEnabled(false);
		user.setMfaTotpSecretEnc(enc);
		user.setMfaTotpSecretSetAt(Instant.now());
		users.save(user);

		return new MfaSetupStartResponse(
				secretBase32,
				otpauthUri(user.getUsername(), secretBase32)
		);
	}

	@Transactional
	public TokenService.TokenPair verifyAndEnable(UUID userId, UUID siteId, String code, String ip, String userAgent) {
		if (code == null || !CODE_6_DIGITS.matcher(code).matches()) {
			throw new IllegalArgumentException("MFA code must be a 6-digit number");
		}

		requireEncryptionConfigured();

		UserAccount user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
		String secretEnc = user.getMfaTotpSecretEnc();
		if (secretEnc == null || secretEnc.isBlank()) {
			throw new IllegalArgumentException("MFA TOTP is not configured for this user");
		}

		byte[] secret = decryptSecret(secretEnc);
		String normalized = code.trim();
		if (!isTotpValid(secret, normalized)) {
			throw new IllegalArgumentException("Invalid MFA code");
		}

		user.setMfaEnabled(true);
		users.save(user);

		CopUserPrincipal principal = principals.requireById(userId);
		return tokens.issueForMfaVerified(principal, siteId, ip, userAgent);
	}

	public record MfaSetupStartResponse(String secretBase32, String otpauthUri) {}

	private static boolean isTotpValid(byte[] secret, String code6) {
		long nowSeconds = Instant.now().getEpochSecond();
		long currentStep = nowSeconds / TOTP_STEP_SECONDS;
		int expected = Integer.parseInt(code6);

		for (long offset = -TOTP_WINDOW_STEPS; offset <= TOTP_WINDOW_STEPS; offset++) {
			long step = currentStep + offset;
			int totp = generateTotp(secret, step);
			if (totp == expected) {
				return true;
			}
		}
		return false;
	}

	private static int generateTotp(byte[] secret, long step) {
		try {
			byte[] data = ByteBuffer.allocate(8).putLong(step).array();
			Mac mac = Mac.getInstance("HmacSHA1");
			mac.init(new SecretKeySpec(secret, "HmacSHA1"));
			byte[] hash = mac.doFinal(data);

			int offset = hash[hash.length - 1] & 0x0f;
			int binary =
					((hash[offset] & 0x7f) << 24) |
					((hash[offset + 1] & 0xff) << 16) |
					((hash[offset + 2] & 0xff) << 8) |
					(hash[offset + 3] & 0xff);

			int otp = binary % (int) Math.pow(10, TOTP_DIGITS);
			return otp;
		} catch (Exception e) {
			throw new IllegalStateException("Failed generating TOTP", e);
		}
	}

	private String encryptBase32Secret(byte[] secret) {
		try {
			requireEncryptionConfigured();
			byte[] iv = randomBytes(12);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(aesKey, "AES"), new GCMParameterSpec(128, iv));
			byte[] ciphertext = cipher.doFinal(secret);

			ByteArrayOutputStream out = new ByteArrayOutputStream();
			out.write(iv);
			out.write(ciphertext);
			return Base64.getEncoder().encodeToString(out.toByteArray());
		} catch (Exception e) {
			throw new IllegalStateException("Failed encrypting MFA secret", e);
		}
	}

	private byte[] decryptSecret(String secretEnc) {
		try {
			requireEncryptionConfigured();
			byte[] all = Base64.getDecoder().decode(secretEnc);
			if (all.length < 13) {
				throw new IllegalArgumentException("Invalid encrypted MFA secret");
			}
			byte[] iv = new byte[12];
			System.arraycopy(all, 0, iv, 0, 12);
			byte[] ciphertext = new byte[all.length - 12];
			System.arraycopy(all, 12, ciphertext, 0, ciphertext.length);

			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey, "AES"), new GCMParameterSpec(128, iv));
			return cipher.doFinal(ciphertext);
		} catch (IllegalArgumentException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("Failed decrypting MFA secret", e);
		}
	}

	private static byte[] randomBytes(int n) {
		byte[] b = new byte[n];
		new java.security.SecureRandom().nextBytes(b);
		return b;
	}

	private void requireEncryptionConfigured() {
		if (aesKey == null || aesKey.length == 0) {
			throw new IllegalStateException(
					"Missing APP_SECURITY_MFA_AES_KEY_BASE64 (required to store/verify MFA secrets encrypted)"
			);
		}
	}

	private String otpauthUri(String username, String secretBase32) {
		// Standard format for Google Auth / Authy.
		String encIssuer = urlEncode(issuer);
		String encAccount = urlEncode(username);
		return "otpauth://totp/" + encIssuer + ":" + encAccount
				+ "?secret=" + secretBase32
				+ "&issuer=" + encIssuer
				+ "&algorithm=SHA1"
				+ "&digits=" + TOTP_DIGITS
				+ "&period=" + TOTP_STEP_SECONDS;
	}

	private static String urlEncode(String v) {
		return java.net.URLEncoder.encode(v, StandardCharsets.UTF_8);
	}

	// Base32 (RFC4648) without padding.
	private static final char[] BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();

	private static String base32Encode(byte[] bytes) {
		StringBuilder out = new StringBuilder();
		int buffer = 0;
		int bitsLeft = 0;
		for (byte b : bytes) {
			buffer = (buffer << 8) | (b & 0xff);
			bitsLeft += 8;
			while (bitsLeft >= 5) {
				int idx = (buffer >> (bitsLeft - 5)) & 0x1f;
				out.append(BASE32_ALPHABET[idx]);
				bitsLeft -= 5;
			}
		}
		if (bitsLeft > 0) {
			int idx = (buffer << (5 - bitsLeft)) & 0x1f;
			out.append(BASE32_ALPHABET[idx]);
		}
		return out.toString();
	}
}

