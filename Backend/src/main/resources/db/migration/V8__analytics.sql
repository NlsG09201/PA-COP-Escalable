-- Incremental analytics rollups (dashboard KPIs). Updated by application listeners, not by heavy ad-hoc scans.

create table if not exists analytics_daily_site_metrics (
  organization_id uuid not null,
  site_id uuid not null,
  day date not null,
  appointments_created bigint not null default 0,
  appointments_confirmed bigint not null default 0,
  appointments_cancelled bigint not null default 0,
  appointments_completed bigint not null default 0,
  patients_new bigint not null default 0,
  revenue_paid_cents bigint not null default 0,
  booked_minutes bigint not null default 0,
  primary key (organization_id, site_id, day)
);

create index if not exists idx_analytics_site_day_range
  on analytics_daily_site_metrics (organization_id, site_id, day);

create table if not exists analytics_daily_specialty_metrics (
  organization_id uuid not null,
  site_id uuid not null,
  day date not null,
  specialty text not null,
  appointments_created bigint not null default 0,
  appointments_confirmed bigint not null default 0,
  appointments_cancelled bigint not null default 0,
  appointments_completed bigint not null default 0,
  revenue_paid_cents bigint not null default 0,
  booked_minutes bigint not null default 0,
  primary key (organization_id, site_id, day, specialty)
);

create index if not exists idx_analytics_specialty_day_range
  on analytics_daily_specialty_metrics (organization_id, site_id, day);

create table if not exists analytics_daily_professional_metrics (
  organization_id uuid not null,
  site_id uuid not null,
  day date not null,
  professional_id uuid not null,
  appointments_created bigint not null default 0,
  appointments_confirmed bigint not null default 0,
  appointments_cancelled bigint not null default 0,
  appointments_completed bigint not null default 0,
  revenue_paid_cents bigint not null default 0,
  booked_minutes bigint not null default 0,
  primary key (organization_id, site_id, day, professional_id)
);

create index if not exists idx_analytics_prof_day_range
  on analytics_daily_professional_metrics (organization_id, site_id, day);

create index if not exists idx_appt_org_site_status_start
  on appointments (organization_id, site_id, status, start_at);

create index if not exists idx_patients_org_site_created
  on patients (organization_id, site_id, created_at);

create index if not exists idx_public_payments_org_site_paid
  on public_payments (organization_id, site_id, paid_at)
  where status = 'PAID';
