package com.cop.escalable.tenancy;

import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping
public class SiteController {
  private final MongoTemplate mongo;
  public SiteController(MongoTemplate mongo) { this.mongo = mongo; }
  @GetMapping("/public/departments") public List<String> departments() { return mongo.getCollection("sites").distinct("department", Filters.and(Filters.eq("status", "ACTIVE"), Filters.exists("department", true)), String.class).into(new ArrayList<>()).stream().filter(s -> s != null && !s.isBlank()).sorted().toList(); }
  @GetMapping("/public/sites") public List<Map<String, Object>> publicSites(@RequestParam(required = false) String department) { return sites(department); }
  @GetMapping("/api/sites") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','SUPER_ADMIN')") public List<Map<String, Object>> adminSites(@RequestParam(required = false) String department) { return sites(department); }
  @GetMapping("/api/sites/departments") @PreAuthorize("hasAnyRole('ADMIN','ORG_ADMIN','SITE_ADMIN','SUPER_ADMIN','MEDICO','PROFESSIONAL')") public Map<String, Object> adminDepartments() { return Map.of("departments", departments()); }
  private List<Map<String, Object>> sites(String department) { var filter = new Document("status", "ACTIVE"); if (department != null && !department.isBlank()) filter.put("department", Pattern.compile("^" + Pattern.quote(department.trim()) + "$", Pattern.CASE_INSENSITIVE)); return mongo.getCollection("sites").find(filter).sort(Sorts.orderBy(Sorts.ascending("department"), Sorts.ascending("name"))).map(d -> Map.<String, Object>of("id", String.valueOf(d.get("_id")), "name", String.valueOf(d.get("name")), "department", d.get("department") == null ? "" : String.valueOf(d.get("department")), "municipality", d.get("municipality") == null ? "" : String.valueOf(d.get("municipality")), "address", d.get("address") == null ? "" : String.valueOf(d.get("address")), "organization_id", String.valueOf(d.get("organization_id")))).into(new ArrayList<>()); }
}
