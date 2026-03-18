package com.COP_Escalable.Backend.iam.infrastructure;

import com.COP_Escalable.Backend.iam.domain.Role;
import com.COP_Escalable.Backend.iam.domain.UserRoleAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRoleAssignment, UserRoleAssignment.Key> {
	List<UserRoleAssignment> findAllByUserId(UUID userId);
	List<UserRoleAssignment> findAllByUserIdIn(List<UUID> userIds);
	List<UserRoleAssignment> findAllByRole(Role role);
}

