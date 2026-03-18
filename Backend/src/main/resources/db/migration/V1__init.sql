-- PostgreSQL baseline schema (shared-schema, multi-tenant via tenant_id)
-- NOTE: All tables include tenant_id for isolation; enforce at app/repository layer too.

create table if not exists organizations (
  id uuid primary key,
  name text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists sites (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  name text not null,
  timezone text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_sites_org on sites(organization_id);

create table if not exists professionals (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  default_site_id uuid references sites(id),
  full_name text not null,
  specialty text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_prof_org on professionals(organization_id);

create table if not exists users (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  username text not null,
  password_hash text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (organization_id, username)
);
create index if not exists idx_users_org on users(organization_id);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  primary key (user_id, role)
);

create table if not exists patients (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  external_code text,
  full_name text not null,
  birth_date date,
  phone text,
  email text,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_patients_org_site on patients(organization_id, site_id);

create table if not exists appointments (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  professional_id uuid not null references professionals(id),
  patient_id uuid not null references patients(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null,
  reason text,
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_appt_org_site_start on appointments(organization_id, site_id, start_at);
create index if not exists idx_appt_prof_start on appointments(professional_id, start_at);

create table if not exists audit_log (
  id uuid primary key,
  organization_id uuid not null,
  site_id uuid,
  actor_user_id uuid,
  actor_username text,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  ip text,
  user_agent text,
  occurred_at timestamptz not null,
  details jsonb
);
create index if not exists idx_audit_org_time on audit_log(organization_id, occurred_at desc);
