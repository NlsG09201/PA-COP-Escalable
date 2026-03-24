package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.AppointmentAssignmentAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AppointmentAssignmentAuditRepository extends JpaRepository<AppointmentAssignmentAudit, UUID> {
}
