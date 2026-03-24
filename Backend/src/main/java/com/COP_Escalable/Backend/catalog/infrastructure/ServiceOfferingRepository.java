package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

	@Query("""
			select o from ServiceOffering o
			join fetch o.catalogService cs
			join fetch cs.category c
			where o.id = :id and o.organizationId = :orgId and o.siteId = :siteId
			  and o.visiblePublic = true and o.active = true and cs.active = true
			""")
	Optional<ServiceOffering> findPublishedById(@Param("id") UUID id, @Param("orgId") UUID orgId, @Param("siteId") UUID siteId);

	@Query("""
			select o from ServiceOffering o
			join fetch o.catalogService cs
			join fetch cs.category c
			where o.organizationId = :orgId and o.siteId = :siteId
			  and o.visiblePublic = true and o.active = true and cs.active = true
			order by c.sortOrder asc, o.publicTitle asc
			""")
	List<ServiceOffering> findAllPublishedForSite(@Param("orgId") UUID orgId, @Param("siteId") UUID siteId);
}
