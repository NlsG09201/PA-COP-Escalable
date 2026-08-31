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
    List<Document> pipeline = new ArrayList<>(); List<Bson> tenant = tenant(p); if (onlyId != null) tenant.add(Filters.in("_id", variants(onlyId))); pipeline.add(new Document("$match", Filters.and(tenant))); pipeline.add(new Document("$lookup", new Document("from", "catalog_services").append("localField", "catalog_service_id").append("foreignField", "_id").append("as", "catalog"))); pipeline.add(new Document("$unwind", new Document("path", "$catalog").append("preserveNullAndEmptyArrays", true))); pipeline.add(new Document("$lookup", new Document("from", "service_categories").append("localField", "catalog.category_id").append("foreignField", "_id").append("as", "categoryDoc"))); pipeline.add(new Document("$unwind", new Document("path", "$categoryDoc").append("preserveNullAndEmptyArrays", true))); if (wantedCategory != null) pipeline.add(new Document("$match", new Document("$expr", new Document("$eq", List.of(new Document("$regexMatch", new Document("input", new Document("$toLower", new Document("$ifNull", List.of("$categoryDoc.slug", "$categoryDoc.name")))).append("regex", "psic")), "PSICOLOGIA".equals(wantedCategory)))))); pipeline.add(new Document("$sort", new Document("updated_at", -1)));
    return mongo.getCollection("service_offerings").aggregate(pipeline).map(this::response).into(new ArrayList<>());
  }
  private Map<String, Object> response(Document row) { Document catalog = row.get("catalog", Document.class); Document category = row.get("categoryDoc", Document.class); String rawCategory = category == null ? "" : String.valueOf(category.get("slug", category.get("name", ""))).toLowerCase(Locale.ROOT); return Map.of("id", String.valueOf(row.get("_id")), "name", String.valueOf(row.get("public_title", catalog == null ? "Servicio" : catalog.get("name", "Servicio"))), "description", String.valueOf(row.get("public_description", catalog == null ? "" : catalog.get("description", ""))), "category", rawCategory.contains("psic") ? "PSICOLOGIA" : "ODONTOLOGIA", "price", ((Number) row.getOrDefault("base_price", 0)).doubleValue(), "duration", catalog == null || catalog.get("default_duration_minutes") == null ? 0 : ((Number) catalog.get("default_duration_minutes")).intValue(), "active", Boolean.TRUE.equals(row.get("active")), "createdAt", row.getDate("created_at") == null ? "" : row.getDate("created_at").toInstant().toString()); }
  private Document category(CopPrincipal p, String value) { boolean psychology = "PSICOLOGIA".equals(value); Document row = mongo.getCollection("service_categories").find(Filters.in("organization_id", variants(p.organizationId()))).into(new ArrayList<>()).stream().filter(d -> String.valueOf(d.get("slug", d.get("name", ""))).toLowerCase(Locale.ROOT).contains(psychology ? "psic" : "odonto")).findFirst().orElse(null); if (row == null) throw new IllegalArgumentException("service category not found for tenant"); return row; }
  private Object resolveSite(CopPrincipal p) { if (p.siteId() != null) return preferredId(p.siteId()); if (!p.roles().stream().anyMatch(ORG_WIDE::contains)) throw new IllegalArgumentException("Se requiere una sede"); Document site = mongo.getCollection("sites").find(Filters.and(Filters.in("organization_id", variants(p.organizationId())), Filters.or(Filters.eq("status", "ACTIVE"), Filters.exists("status", false), Filters.eq("status", null)))).first(); if (site == null) throw new IllegalArgumentException("Se requiere una sede"); return site.get("_id"); }
  private List<Bson> tenant(CopPrincipal p) { List<Bson> out = new ArrayList<>(); out.add(Filters.in("organization_id", variants(p.organizationId()))); if (p.siteId() != null && p.roles().stream().noneMatch(ORG_WIDE::contains)) out.add(Filters.in("site_id", variants(p.siteId()))); return out; }
  private List<Object> variants(String id) { List<Object> out = new ArrayList<>(); out.add(id); try { out.add(UUID.fromString(id)); } catch (Exception ignored) {} return out; }
  private Object preferredId(String id) { try { return UUID.fromString(id); } catch (Exception ignored) { return id; } }
  private String blank(String value) { return value == null ? "" : value.trim(); }
  private String slug(String name) { return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "").substring(0, Math.min(64, name.length())); }
}
