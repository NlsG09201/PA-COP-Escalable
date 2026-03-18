package com.COP_Escalable.Backend.psychtests.infrastructure;

import com.COP_Escalable.Backend.psychtests.domain.TestTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TestTemplateRepository extends MongoRepository<TestTemplate, UUID> {
	List<TestTemplate> findAllByOrganizationId(UUID organizationId);
	Optional<TestTemplate> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

