package com.cop.escalable.patients;

import com.cop.escalable.patients.dto.CreatePatientRequest;
import com.cop.escalable.security.CopPrincipal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.bson.Document;
import org.bson.conversions.Bson;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

@Service
public class PatientService {
  private static final List<String> ORG_WIDE = List.of("SUPER_ADMIN", "ADMIN", "ORG_ADMIN");
  private final MongoTemplate mongo;
  public PatientService(MongoTemplate mongo) { this.mongo = mongo; }
  public Map<String, Object> page(CopPrincipal principal, int page, int size, String search) {
    int safePage = Math.max(0, page), safeSize = Math.min(500, Math.max(1, size));
    List<Bson> filters = new ArrayList<>(); filters.add(Filters.in("organization_id", idVariants(principal.organizationId())));
    if (principal.siteId() != null && principal.roles().stream().noneMatch(ORG_WIDE::contains)) filters.add(Filters.or(Filters.in("site_id", idVariants(principal.siteId())), Filters.eq("site_id", null), Filters.exists("site_id", false)));
    if (search != null && !search.isBlank()) { Pattern value = Pattern.compile(Pattern.quote(search.trim()), Pattern.CASE_INSENSITIVE); filters.add(Filters.or(Filters.regex("full_name", value), Filters.regex("email", value), Filters.regex("phone", value), Filters.regex("external_code", value))); }
    Bson match = filters.size() == 1 ? filters.getFirst() : Filters.and(filters);
    var collection = mongo.getCollection("patients"); long total = collection.countDocuments(match);
    List<Map<String, Object>> items = collection.find(match).sort(Sorts.orderBy(Sorts.descending("updated_at"), Sorts.ascending("full_name"))).skip(safePage * safeSize).limit(safeSize).map(this::toResponse).into(new ArrayList<>());
    return Map.of("items", items, "page", safePage, "size", safeSize, "total", total, "hasNext", (long) (safePage + 1) * safeSize < total);
  }
  public Map<String, Object> create(CreatePatientRequest request, CopPrincipal principal) {
    Document document = new Document("organization_id", preferredId(principal.organizationId())).append("site_id", principal.siteId() == null ? null : preferredId(principal.siteId())).append("external_code", request.external_code()).append("full_name", request.full_name().trim()).append("birth_date", parseDate(request.birth_date())).append("gender", request.gender()).append("phone", request.phone()).append("email", request.email()).append("status", "ACTIVE").append("created_at", java.util.Date.from(Instant.now())).append("updated_at", java.util.Date.from(Instant.now()));
    mongo.getCollection("patients").insertOne(document); return toResponse(document);
  }
  private Map<String, Object> toResponse(Document d) {
    Document copy = new Document(d); String id = String.valueOf(copy.get("_id")); copy.put("id", id); copy.put("name", copy.get("full_name")); copy.put("document", copy.get("external_code")); copy.put("lastVisit", copy.get("updated_at")); return copy;
  }
  private Object parseDate(String date) { return date == null || date.isBlank() ? null : java.util.Date.from(LocalDate.parse(date).atStartOfDay().toInstant(ZoneOffset.UTC)); }
  private List<Object> idVariants(String raw) { List<Object> variants = new ArrayList<>(); variants.add(raw); try { variants.add(UUID.fromString(raw)); } catch (IllegalArgumentException ignored) {} return variants; }
  private Object preferredId(String raw) { try { return UUID.fromString(raw); } catch (IllegalArgumentException ignored) { return raw; } }
}
