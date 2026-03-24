package com.COP_Escalable.Backend.notifications.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(
		name = "notification_medical_alert_contacts",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_notification_medical_alert_contact_address",
				columnNames = {"organization_id", "site_id", "audience", "channel", "address"}
		)
)
public class MedicalAlertSiteContact extends TenantScopedEntity {

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AlertAudience audience;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private NotificationDelivery.Channel channel;

	@Column(nullable = false)
	private String address;

	@Column
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
