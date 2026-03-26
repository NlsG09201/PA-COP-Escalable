package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "notification_medical_alert_contacts")
public class MedicalAlertSiteContact extends TenantScopedEntity {

	private AlertAudience audience;

	private NotificationDelivery.Channel channel;

	private String address;

	private String label;

	protected MedicalAlertSiteContact() {}

	public static MedicalAlertSiteContact create(
			UUID organizationId,
			UUID siteId,
			AlertAudience audience,
			NotificationDelivery.Channel channel,
			String address,
			String label
	) {
		if (audience == AlertAudience.PATIENT) {
			throw new IllegalArgumentException("audience must be PROFESSIONALS or ADMINS");
		}
		if (siteId == null) {
			throw new IllegalArgumentException("siteId is required");
		}
		var c = new MedicalAlertSiteContact();
		c.setTenant(organizationId, siteId);
		c.audience = audience;
		c.channel = channel;
		c.address = address;
		c.label = label == null || label.isBlank() ? null : label.trim();
		return c;
	}

	public void update(AlertAudience audience, NotificationDelivery.Channel channel, String address, String label) {
		if (audience == AlertAudience.PATIENT) {
			throw new IllegalArgumentException("audience must be PROFESSIONALS or ADMINS");
		}
		this.audience = audience;
		this.channel = channel;
		this.address = address;
		this.label = label == null || label.isBlank() ? null : label.trim();
	}

	public AlertAudience getAudience() {
		return audience;
	}

	public NotificationDelivery.Channel getChannel() {
		return channel;
	}

	public String getAddress() {
		return address;
	}

	public String getLabel() {
		return label;
	}
}
