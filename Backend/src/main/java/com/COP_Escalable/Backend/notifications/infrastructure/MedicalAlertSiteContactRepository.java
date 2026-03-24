package com.COP_Escalable.Backend.notifications.infrastructure;

import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.MedicalAlertSiteContact;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MedicalAlertSiteContactRepository extends JpaRepository<MedicalAlertSiteContact, UUID> {

	List<MedicalAlertSiteContact> findAllByOrganizationIdAndSiteIdOrderByCreatedAtAsc(UUID organizationId, UUID siteId);

	Optional<MedicalAlertSiteContact> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);

	boolean existsByOrganizationIdAndSiteIdAndAudienceAndChannelAndAddress(
			UUID organizationId,
			UUID siteId,
			AlertAudience audience,
			NotificationDelivery.Channel channel,
			String address
	);
}
