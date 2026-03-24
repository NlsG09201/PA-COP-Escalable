package com.COP_Escalable.Backend.therapy.infrastructure;

import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TherapyModuleRepository extends JpaRepository<TherapyModuleEntity, UUID> {

	List<TherapyModuleEntity> findByActiveTrue();

	List<TherapyModuleEntity> findByCategory(String category);

	List<TherapyModuleEntity> findByCategoryAndActiveTrue(String category);
}
