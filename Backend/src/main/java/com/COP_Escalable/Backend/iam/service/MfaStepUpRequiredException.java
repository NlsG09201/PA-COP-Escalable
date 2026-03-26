package com.COP_Escalable.Backend.iam.service;

/**
 * Thrown when refresh token rotation is requested while MFA is enabled
 * but the session has not completed MFA verification ({@code mfa_verified=false}).
 */
public class MfaStepUpRequiredException extends RuntimeException {

	public MfaStepUpRequiredException() {
		super("Complete MFA verification before rotating refresh tokens");
	}
}
