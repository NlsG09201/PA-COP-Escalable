package com.COP_Escalable.Backend.therapy.infrastructure;

import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface TherapyModuleRepository extends MongoRepository<TherapyModuleEntity, UUID> {

	List<TherapyModuleEntity> findByActiveTrue();

	List<TherapyModuleEntity> findByCategory(String category);

	List<TherapyModuleEntity> findByCategoryAndActiveTrue(String category);
}
