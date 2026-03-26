package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.AppointmentAssignmentAudit;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.UUID;

public interface AppointmentAssignmentAuditRepository extends MongoRepository<AppointmentAssignmentAudit, UUID> {
}
