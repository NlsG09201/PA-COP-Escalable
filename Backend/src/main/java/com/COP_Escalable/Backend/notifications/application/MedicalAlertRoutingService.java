package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.clinical.application.MedicalAlertNotificationEvent;
import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import com.COP_Escalable.Backend.notifications.infrastructure.MedicalAlertSiteContactRepository;
import com.COP_Escalable.Backend.patients.domain.Patient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class MedicalAlertRoutingService {
	private final MedicalAlertRoutingProperties properties;
	private final MedicalAlertSiteContactRepository siteContacts;

	public MedicalAlertRoutingService(
			MedicalAlertRoutingProperties properties,
			MedicalAlertSiteContactRepository siteContacts
	) {
		this.properties = properties;
		this.siteContacts = siteContacts;
	}

	public List<DeliveryTarget> resolveTargets(
			MedicalAlertNotificationEvent event,
			Patient patient,
			String subject,
			String body
	) {
		if (!properties.enabled()) {
			return List.of();
		}

		var routes = properties.audiencesFor(event.siteId(), event.severity());
		var contacts = properties.contactsWithDatabaseOverlay(event.siteId(), buildDatabaseRecipients(event.organizationId(), event.siteId()));
		var targets = new ArrayList<DeliveryTarget>();
		var deduplication = new LinkedHashSet<String>();

		for (var audience : routes) {
			switch (audience) {
				case PATIENT -> {
					addTarget(targets, deduplication, audience, NotificationDelivery.Channel.EMAIL, patient.getEmail(), subject, body, templateCode(event, audience, "email"));
					addTarget(targets, deduplication, audience, NotificationDelivery.Channel.WHATSAPP, patient.getPhone(), subject, body, templateCode(event, audience, "whatsapp"));
				}
				case PROFESSIONALS -> {
					for (var email : contacts.professionals().email()) {
						addTarget(targets, deduplication, audience, NotificationDelivery.Channel.EMAIL, email, subject, body, templateCode(event, audience, "email"));
					}
					for (var whatsapp : contacts.professionals().whatsapp()) {
						addTarget(targets, deduplication, audience, NotificationDelivery.Channel.WHATSAPP, whatsapp, subject, body, templateCode(event, audience, "whatsapp"));
					}
				}
				case ADMINS -> {
					for (var email : contacts.admins().email()) {
						addTarget(targets, deduplication, audience, NotificationDelivery.Channel.EMAIL, email, subject, body, templateCode(event, audience, "email"));
					}
					for (var whatsapp : contacts.admins().whatsapp()) {
						addTarget(targets, deduplication, audience, NotificationDelivery.Channel.WHATSAPP, whatsapp, subject, body, templateCode(event, audience, "whatsapp"));
					}
				}
			}
		}

		return List.copyOf(targets);
	}

	private void addTarget(
			List<DeliveryTarget> targets,
			Set<String> deduplication,
			AlertAudience audience,
			NotificationDelivery.Channel channel,
			String recipient,
			String subject,
			String body,
			String templateCode
	) {
		String normalizedRecipient = recipient == null ? "" : recipient.trim();
		String deduplicationKey = audience.name() + "|" + channel.name() + "|" + normalizedRecipient.toLowerCase(Locale.ROOT);
		if (!deduplication.add(deduplicationKey)) {
			return;
		}
		targets.add(new DeliveryTarget(audience, channel, normalizedRecipient, templateCode, subject, body));
	}

	private String templateCode(MedicalAlertNotificationEvent event, AlertAudience audience, String channel) {
		return "medical-alert-" + event.severity().toLowerCase(Locale.ROOT) + "-" + audience.name().toLowerCase(Locale.ROOT) + "-" + channel;
	}

	private MedicalAlertRoutingProperties.AlertRecipients buildDatabaseRecipients(UUID organizationId, UUID siteId) {
		if (organizationId == null || siteId == null) {
			return new MedicalAlertRoutingProperties.AlertRecipients(
					new MedicalAlertRoutingProperties.AudienceContacts(List.of(), List.of()),
					new MedicalAlertRoutingProperties.AudienceContacts(List.of(), List.of())
			);
		}
		var rows = siteContacts.findAllByOrganizationIdAndSiteIdOrderByCreatedAtAsc(organizationId, siteId);
		var profEmails = new ArrayList<String>();
		var profWhatsapp = new ArrayList<String>();
		var adminEmails = new ArrayList<String>();
		var adminWhatsapp = new ArrayList<String>();
		for (var row : rows) {
			switch (row.getAudience()) {
				case PROFESSIONALS -> {
					if (row.getChannel() == NotificationDelivery.Channel.EMAIL) {
						profEmails.add(row.getAddress());
					} else {
						profWhatsapp.add(row.getAddress());
					}
				}
				case ADMINS -> {
					if (row.getChannel() == NotificationDelivery.Channel.EMAIL) {
						adminEmails.add(row.getAddress());
					} else {
						adminWhatsapp.add(row.getAddress());
					}
				}
				default -> {
				}
			}
		}
		return new MedicalAlertRoutingProperties.AlertRecipients(
				new MedicalAlertRoutingProperties.AudienceContacts(profEmails, profWhatsapp),
				new MedicalAlertRoutingProperties.AudienceContacts(adminEmails, adminWhatsapp)
		);
	}
}
