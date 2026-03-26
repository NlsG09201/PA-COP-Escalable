package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Organization;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.UUID;

public interface OrganizationRepository extends MongoRepository<Organization, UUID> {
}
