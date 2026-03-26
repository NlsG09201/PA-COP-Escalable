package com.COP_Escalable.Backend.iam.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.web.authentication.WebAuthenticationDetails;
import org.springframework.stereotype.Component;

/**
 * Structured security audit trail (login success/failure). Extend with SIEM forwarding as needed.
 */
@Component
public class SecurityAuditListener {

	private static final Logger log = LoggerFactory.getLogger("SECURITY_AUDIT");

	@EventListener
	public void onSuccess(AuthenticationSuccessEvent event) {
		String user = event.getAuthentication().getName();
		String remote = extractRemote(event);
		log.info("AUTHN_SUCCESS user={} remote={}", user, remote);
	}

	@EventListener
	public void onFailure(AbstractAuthenticationFailureEvent event) {
		String user = event.getAuthentication().getName();
		String remote = extractRemote(event);
		log.warn("AUTHN_FAILURE type={} user={} remote={} message={}",
				event.getException().getClass().getSimpleName(),
				user,
				remote,
				event.getException().getMessage());
	}

	private static String extractRemote(AuthenticationSuccessEvent event) {
		var details = event.getAuthentication().getDetails();
		if (details instanceof WebAuthenticationDetails w) {
			return w.getRemoteAddress();
		}
		return "";
	}

	private static String extractRemote(AbstractAuthenticationFailureEvent event) {
		var details = event.getAuthentication().getDetails();
		if (details instanceof WebAuthenticationDetails w) {
			return w.getRemoteAddress();
		}
		return "";
	}
}
