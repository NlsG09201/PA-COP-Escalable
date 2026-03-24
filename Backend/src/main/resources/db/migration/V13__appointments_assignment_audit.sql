create table if not exists appointment_assignment_audit (
  id uuid primary key,
  organization_id uuid not null,
  site_id uuid not null,
  patient_id uuid not null,
  appointment_type text not null,
  priority text not null,
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  winner_professional_id uuid,
  winner_score double precision,
  candidates_payload text,
  alternatives_payload text,
  outcome text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_assignment_audit_org_site_created
  on appointment_assignment_audit(organization_id, site_id, created_at desc);
