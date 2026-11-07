package com.cop.escalable.appointments;

import com.cop.escalable.security.CopPrincipal;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppointmentService {
  private static final List<String> ORG_WIDE = List.of("SUPER_ADMIN", "ADMIN", "ORG_ADMIN");
  private static final List<String> STATUS = List.of("REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED");
  private final MongoTemplate mongo;
  public AppointmentService(MongoTemplate mongo) { this.mongo = mongo; }
  public List<Map<String, Object>> professionals(CopPrincipal principal) {
    return mongo.getCollection("professionals").find(Filters.and(Filters.in("organization_id", idVariants(principal.organizationId())), Filters.eq("status", "ACTIVE"))).sort(Sorts.ascending("full_name")).map(d -> Map.<String, Object>of("id", String.valueOf(d.get("_id")), "name", String.valueOf(d.get("full_name")))).into(new ArrayList<>());
  }
  public Map<String, Object> list(CopPrincipal principal, String from, String to, int page, int size, String professionalId, String status, boolean unassignedOnly) {
    int safePage = Math.max(0, page), safeSize = Math.min(200, Math.max(1, size)); List<Bson> filters = tenantFilters(principal);
    if (unassignedOnly) filters.add(Filters.or(Filters.eq("professional_id", null), Filters.exists("professional_id", false))); else if (professionalId != null && !professionalId.isBlank()) filters.add(Filters.in("professional_id", idVariants(professionalId)));
    if (status != null && !status.isBlank()) { validateStatus(status); filters.add(Filters.eq("status", status)); }
    if (from != null && to != null) filters.add(Filters.and(Filters.gte("start_at", date(from)), Filters.lte("start_at", date(to))));
    Bson filter = filters.size() == 1 ? filters.getFirst() : Filters.and(filters); var appointments = mongo.getCollection("appointments"); long total = appointments.countDocuments(filter);
    List<Map<String, Object>> items = appointments.find(filter).sort(Sorts.ascending("start_at")).skip(safePage * safeSize).limit(safeSize).map(this::response).into(new ArrayList<>());
    return Map.of("items", items, "page", safePage, "size", safeSize, "total", total, "hasNext", (long)(safePage + 1) * safeSize < total);
  }
  public Map<String, Object> create(CopPrincipal principal, Map<String, Object> body) {
    Document doc = new Document(body); doc.remove("_id"); doc.put("organization_id", preferredId(principal.organizationId())); if (principal.siteId() != null) doc.put("site_id", preferredId(principal.siteId()));
    doc.put("status", "REQUESTED"); doc.put("created_at", new Date()); doc.put("updated_at", new Date()); mongo.getCollection("appointments").insertOne(doc); return response(doc);
  }
  public Map<String, Object> updateStatus(CopPrincipal principal, String id, String status) {
    validateStatus(status); Document appointment = findScoped(principal, id); mongo.getCollection("appointments").updateOne(Filters.eq("_id", appointment.get("_id")), new Document("$set", new Document("status", status).append("updated_at", new Date()))); appointment.put("status", status); return response(appointment);
  }
  public Map<String, Object> claim(CopPrincipal principal, String appointmentId, String professionalId) {
    Document appointment = findScoped(principal, appointmentId); if (appointment.get("professional_id") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "La cita ya tiene un profesional asignado");
    Object professional = preferredId(professionalId); Document doctor = mongo.getCollection("professionals").find(Filters.and(Filters.in("_id", idVariants(professionalId)), Filters.in("organization_id", idVariants(principal.organizationId())), Filters.eq("status", "ACTIVE"))).first(); if (doctor == null) throw new IllegalArgumentException("Profesional no encontrado");
    Date start = asDate(appointment.get("start_at")), end = asDate(appointment.get("end_at")); if (start == null || end == null) throw new IllegalArgumentException("La cita no tiene un horario válido");
    Bson overlap = Filters.and(Filters.ne("_id", appointment.get("_id")), Filters.in("professional_id", idVariants(professionalId)), Filters.in("organization_id", idVariants(principal.organizationId())), Filters.in("status", List.of("REQUESTED", "CONFIRMED", "COMPLETED")), Filters.lt("start_at", end), Filters.gt("end_at", start));
    if (mongo.getCollection("appointments").find(overlap).first() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "El profesional ya tiene otra cita en ese horario");
    Date now = new Date(); mongo.getCollection("appointments").updateOne(Filters.eq("_id", appointment.get("_id")), new Document("$set", new Document("professional_id", professional).append("updated_at", now))); mongo.getCollection("public_bookings").updateMany(Filters.eq("appointment_id", appointment.get("_id")), new Document("$set", new Document("professional_id", professional).append("updated_at", now))); appointment.put("professional_id", professional); return response(appointment);
  }
  private Document findScoped(CopPrincipal principal, String id) { List<Bson> filters = tenantFilters(principal); filters.add(Filters.in("_id", idVariants(id))); Document appointment = mongo.getCollection("appointments").find(Filters.and(filters)).first(); if (appointment == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"); return appointment; }
  private List<Bson> tenantFilters(CopPrincipal principal) { List<Bson> filters = new ArrayList<>(); filters.add(Filters.in("organization_id", idVariants(principal.organizationId()))); if (principal.siteId() != null && principal.roles().stream().noneMatch(ORG_WIDE::contains)) filters.add(Filters.in("site_id", idVariants(principal.siteId()))); return filters; }
  private Map<String, Object> response(Document d) { Date start = asDate(d.get("start_at")), end = asDate(d.get("end_at")); Map<String, Object> out = new java.util.LinkedHashMap<>(); out.put("id", String.valueOf(d.get("_id"))); out.put("startAt", start == null ? null : start.toInstant().toString()); out.put("endAt", end == null ? null : end.toInstant().toString()); out.put("start", start == null ? null : start.toInstant().toString()); out.put("end", end == null ? null : end.toInstant().toString()); out.put("status", d.get("status") == null ? "REQUESTED" : String.valueOf(d.get("status"))); out.put("reason", d.get("reason")); out.put("professionalId", d.get("professional_id") == null ? null : String.valueOf(d.get("professional_id"))); out.put("patientId", d.get("patient_id") == null ? null : String.valueOf(d.get("patient_id"))); out.put("serviceNameSnapshot", d.get("service_name_snapshot")); out.put("serviceCategorySnapshot", d.get("service_category_snapshot")); return out; }
  private Date date(String raw) { try { return Date.from(Instant.parse(raw)); } catch (Exception e) { throw new IllegalArgumentException("Invalid date-time query parameter"); } }
  private Date asDate(Object value) { if (value instanceof Date date) return date; if (value instanceof String s) try { return Date.from(Instant.parse(s)); } catch (Exception ignored) {} return null; }
  private void validateStatus(String value) { if (!STATUS.contains(value)) throw new IllegalArgumentException("Invalid appointment status"); }
  private List<Object> idVariants(String raw) { List<Object> out = new ArrayList<>(); out.add(raw); try { out.add(UUID.fromString(raw)); } catch (Exception ignored) {} return out; }
  private Object preferredId(String raw) { try { return UUID.fromString(raw); } catch (Exception ignored) { return raw; } }
}
