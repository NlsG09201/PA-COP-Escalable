package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.CatalogServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CatalogServiceItemRepository extends JpaRepository<CatalogServiceItem, UUID> {
	Optional<CatalogServiceItem> findByIdAndOrganizationId(UUID id, UUID organizationId);

	@Query("""
			select (count(cs) > 0) from CatalogServiceItem cs
			where cs.organizationId = :orgId
			  and cs.category.id = :categoryId
			  and lower(cs.name) = lower(:name)
			  and (:excludeId is null or cs.id <> :excludeId)
			""")
	boolean existsByCategoryAndName(
			@Param("orgId") UUID organizationId,
			@Param("categoryId") UUID categoryId,
			@Param("name") String name,
			@Param("excludeId") UUID excludeId
	);
}
