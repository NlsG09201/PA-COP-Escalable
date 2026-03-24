package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.MedicalAlertSiteContact;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import com.COP_Escalable.Backend.notifications.infrastructure.MedicalAlertSiteContactRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class MedicalAlertSiteContactService {
	private final MedicalAlertSiteContactRepository contacts;
	private final SiteRepository sites;

	public MedicalAlertSiteContactService(MedicalAlertSiteContactRepository contacts, SiteRepository sites) {
		this.contacts = contacts;
		this.sites = sites;
	}

	@Transactional(readOnly = true)
	public List<MedicalAlertSiteContact> listForCurrentSite() {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		return listForOrganizationSite(ctx.siteId());
	}

	@Transactional(readOnly = true)
	public List<MedicalAlertSiteContact> listForOrganizationSite(UUID siteId) {
		var orgId = requireOrganizationId();
		ensureSiteBelongsToOrg(orgId, siteId);
		return contacts.findAllByOrganizationIdAndSiteIdOrderByCreatedAtAsc(orgId, siteId);
	}

	@Transactional
	public MedicalAlertSiteContact create(AlertAudience audience, NotificationDelivery.Channel channel, String address, String label) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		return createForOrganizationSite(ctx.siteId(), audience, channel, address, label);
	}

	@Transactional
	public MedicalAlertSiteContact createForOrganizationSite(
			UUID siteId,
			AlertAudience audience,
			NotificationDelivery.Channel channel,
			String address,
			String label
	) {
		var orgId = requireOrganizationId();
		if (audience == AlertAudience.PATIENT) {
			throw new IllegalArgumentException("audience must be PROFESSIONALS or ADMINS");
		}
		String normalized = normalizeAddress(channel, requireText(address, "address"));
		ensureSiteBelongsToOrg(orgId, siteId);
		if (contacts.existsByOrganizationIdAndSiteIdAndAudienceAndChannelAndAddress(
				orgId, siteId, audience, channel, normalized
		)) {
			throw new IllegalArgumentException("Contact already exists for this site, audience and channel");
		}
		var entity = MedicalAlertSiteContact.create(orgId, siteId, audience, channel, normalized, label);
		return contacts.save(entity);
	}

	@Transactional
	public MedicalAlertSiteContact update(UUID id, AlertAudience audience, NotificationDelivery.Channel channel, String address, String label) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		return updateForOrganizationSite(ctx.siteId(), id, audience, channel, address, label);
	}

	@Transactional
	public MedicalAlertSiteContact updateForOrganizationSite(
			UUID siteId,
			UUID id,
			AlertAudience audience,
			NotificationDelivery.Channel channel,
			String address,
			String label
	) {
		var orgId = requireOrganizationId();
		if (audience == AlertAudience.PATIENT) {
			throw new IllegalArgumentException("audience must be PROFESSIONALS or ADMINS");
		}
		ensureSiteBelongsToOrg(orgId, siteId);
		var existing = contacts.findByIdAndOrganizationIdAndSiteId(id, orgId, siteId)
				.orElseThrow(() -> new IllegalArgumentException("Contact not found"));
		String normalized = normalizeAddress(channel, requireText(address, "address"));
		if (!existing.getAudience().equals(audience)
				|| !existing.getChannel().equals(channel)
				|| !existing.getAddress().equals(normalized)) {
			if (contacts.existsByOrganizationIdAndSiteIdAndAudienceAndChannelAndAddress(
					orgId, siteId, audience, channel, normalized
			)) {
				throw new IllegalArgumentException("Contact already exists for this site, audience and channel");
			}
		}
		existing.update(audience, channel, normalized, label);
		return contacts.save(existing);
	}

	@Transactional
	public void delete(UUID id) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		deleteForOrganizationSite(ctx.siteId(), id);
	}

	@Transactional
	public void deleteForOrganizationSite(UUID siteId, UUID id) {
		var orgId = requireOrganizationId();
		ensureSiteBelongsToOrg(orgId, siteId);
		var existing = contacts.findByIdAndOrganizationIdAndSiteId(id, orgId, siteId)
				.orElseThrow(() -> new IllegalArgumentException("Contact not found"));
		contacts.delete(existing);
	}

	private UUID requireOrganizationId() {
		return TenantContextHolder.require().organizationId();
	}

	private void ensureSiteBelongsToOrg(UUID organizationId, UUID siteId) {
		if (siteId == null) {
			throw new IllegalArgumentException("siteId is required");
		}
		sites.findByIdAndOrganizationId(siteId, organizationId)
				.orElseThrow(() -> new IllegalArgumentException("Site not found in organization"));
	}

	private static String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " is required");
		}
		return value.trim();
	}

	private static String normalizeAddress(NotificationDelivery.Channel channel, String address) {
		return channel == NotificationDelivery.Channel.EMAIL ? address.toLowerCase(Locale.ROOT) : address;
	}
}
