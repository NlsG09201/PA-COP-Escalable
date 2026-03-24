-- Performance indexes to keep query latency stable under high volume workloads.
create index if not exists idx_appointments_org_site_start_status
  on appointments (organization_id, site_id, start_at, status);

create index if not exists idx_patients_org_site_status
  on patients (organization_id, site_id, status);
