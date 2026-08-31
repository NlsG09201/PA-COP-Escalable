package com.cop.escalable.catalog;

import com.cop.escalable.catalog.dto.ServiceRequest;
import com.cop.escalable.security.CopPrincipal;
import com.mongodb.client.model.Filters;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CatalogService {
  private static final List<String> ORG_WIDE = List.of("SUPER_ADMIN", "ADMIN", "ORG_ADMIN");
  private final MongoTemplate mongo;
  public CatalogService(MongoTemplate mongo) { this.mongo = mongo; }
  public List<Map<String, Object>> list(CopPrincipal p, String category) { return aggregate(p, category, null); }
  public Map<String, Object> create(CopPrincipal p, ServiceRequest request) {
    Document category = category(p, request.category()); Object site = resolveSite(p); UUID catalogId = UUID.randomUUID(), offeringId = UUID.randomUUID(); Date now = Date.from(Instant.now());
    mongo.getCollection("catalog_services").insertOne(new Document("_id", catalogId).append("organization_id", preferredId(p.organizationId())).append("category_id", category.get("_id")).append("code", slug(request.name())).append("name", request.name().trim()).append("description", blank(request.description())).append("default_duration_minutes", request.duration()).append("specialty_match_tokens", "").append("active", true).append("created_at", now).append("updated_at", now));
    mongo.getCollection("service_offerings").insertOne(new Document("_id", offeringId).append("catalog_service_id", catalogId).append("public_title", request.name().trim()).append("public_description", blank(request.description())).append("base_price", request.price()).append("currency", "COP").append("visible_public", true).append("active", true).append("organization_id", preferredId(p.organizationId())).append("site_id", site).append("created_at", now).append("updated_at", now));
    return one(p, offeringId.toString());
  }
  public Map<String, Object> update(CopPrincipal p, String id, ServiceRequest request) { Document offering = scopedOffering(p, id); Document category = category(p, request.category()); Date now = new Date(); mongo.getCollection("service_offerings").updateOne(Filters.eq("_id", offering.get("_id")), new Document("$set", new Document("public_title", request.name().trim()).append("public_description", blank(request.description())).append("base_price", request.price()).append("updated_at", now))); mongo.getCollection("catalog_services").updateOne(Filters.eq("_id", offering.get("catalog_service_id")), new Document("$set", new Document("name", request.name().trim()).append("description", blank(request.description())).append("category_id", category.get("_id")).append("default_duration_minutes", request.duration()).append("updated_at", now))); return one(p, id); }
  public Map<String, Object> status(CopPrincipal p, String id, boolean active) { Document offering = scopedOffering(p, id); Date now = new Date(); mongo.getCollection("service_offerings").updateOne(Filters.eq("_id", offering.get("_id")), new Document("$set", new Document("active", active).append("updated_at", now))); mongo.getCollection("catalog_services").updateOne(Filters.eq("_id", offering.get("catalog_service_id")), new Document("$set", new Document("active", active).append("updated_at", now))); return one(p, id); }
  public Map<String, Object> remove(CopPrincipal p, String id) { Document offering = scopedOffering(p, id); mongo.getCollection("service_offerings").deleteOne(Filters.eq("_id", offering.get("_id"))); mongo.getCollection("catalog_services").deleteOne(Filters.eq("_id", offering.get("catalog_service_id"))); return Map.of("ok", true); }
  private Map<String, Object> one(CopPrincipal p, String id) { List<Map<String, Object>> found = aggregate(p, null, id); if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"); return found.getFirst(); }
  private Document scopedOffering(CopPrincipal p, String id) { List<Bson> filters = tenant(p); filters.add(Filters.in("_id", variants(id))); Document row = mongo.getCollection("service_offerings").find(Filters.and(filters)).first(); if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"); return row; }
  private List<Map<String, Object>> aggregate(CopPrincipal p, String wantedCategory, String onlyId) {
    List<Bson> filter = tenant(p); if (onlyId != null) filter.add(Filters.in("_id", variants(onlyId)));
    List<Map<String, Object>> out = new ArrayList<>();
    for (Document offering : mongo.getCollection("service_offerings").find(Filters.and(filter)).sort(new Document("updated_at", -1))) {
      Document catalog = offering.get("catalog_service_id") == null ? null : mongo.getCollection("catalog_services").find(Filters.eq("_id", offering.get("catalog_service_id"))).first();
      Document category = catalog == null || catalog.get("category_id") == null ? null : mongo.getCollection("service_categories").find(Filters.eq("_id", catalog.get("category_id"))).first();
      String categoryName = categoryName(category);
      if (wantedCategory == null || wantedCategory.equals(categoryName)) out.add(response(offering, catalog, categoryName));
    }
    return out;
  }
  private Map<String, Object> response(Document row, Document catalog, String categoryName) { Map<String, Object> out = new java.util.LinkedHashMap<>(); out.put("id", String.valueOf(row.get("_id"))); out.put("name", row.getOrDefault("public_title", catalog == null ? "Servicio" : catalog.getOrDefault("name", "Servicio"))); out.put("description", row.getOrDefault("public_description", catalog == null ? "" : catalog.getOrDefault("description", ""))); out.put("category", categoryName); out.put("price", ((Number) row.getOrDefault("base_price", 0)).doubleValue()); out.put("duration", catalog == null ? null : catalog.get("default_duration_minutes")); out.put("active", Boolean.TRUE.equals(row.get("active"))); out.put("createdAt", row.getDate("created_at") == null ? "" : row.getDate("created_at").toInstant().toString()); return out; }
  private String categoryName(Document category) { String raw = category == null ? "" : String.valueOf(category.getOrDefault("slug", category.getOrDefault("name", ""))).toLowerCase(Locale.ROOT); return raw.contains("psic") ? "PSICOLOGIA" : "ODONTOLOGIA"; }
  private Document category(CopPrincipal p, String value) { boolean psychology = "PSICOLOGIA".equals(value); Document row = mongo.getCollection("service_categories").find(Filters.in("organization_id", variants(p.organizationId()))).into(new ArrayList<>()).stream().filter(d -> String.valueOf(d.getOrDefault("slug", d.getOrDefault("name", ""))).toLowerCase(Locale.ROOT).contains(psychology ? "psic" : "odonto")).findFirst().orElse(null); if (row == null) throw new IllegalArgumentException("service category not found for tenant"); return row; }
  private Object resolveSite(CopPrincipal p) { if (p.siteId() != null) return preferredId(p.siteId()); if (!p.roles().stream().anyMatch(ORG_WIDE::contains)) throw new IllegalArgumentException("Se requiere una sede"); Document site = mongo.getCollection("sites").find(Filters.and(Filters.in("organization_id", variants(p.organizationId())), Filters.or(Filters.eq("status", "ACTIVE"), Filters.exists("status", false), Filters.eq("status", null)))).first(); if (site == null) throw new IllegalArgumentException("Se requiere una sede"); return site.get("_id"); }
  private List<Bson> tenant(CopPrincipal p) { List<Bson> out = new ArrayList<>(); out.add(Filters.in("organization_id", variants(p.organizationId()))); if (p.siteId() != null && p.roles().stream().noneMatch(ORG_WIDE::contains)) out.add(Filters.in("site_id", variants(p.siteId()))); return out; }
  private List<Object> variants(String id) { List<Object> out = new ArrayList<>(); out.add(id); try { out.add(UUID.fromString(id)); } catch (Exception ignored) {} return out; }
  private Object preferredId(String id) { try { return UUID.fromString(id); } catch (Exception ignored) { return id; } }
  private String blank(String value) { return value == null ? "" : value.trim(); }
  private String slug(String name) { String normalized = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""); return normalized.substring(0, Math.min(64, normalized.length())); }
}
