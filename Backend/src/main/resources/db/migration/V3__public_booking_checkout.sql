create table if not exists public_bookings (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  service_id text not null,
  service_name text not null,
  service_category text not null,
  patient_name text not null,
  patient_email text,
  patient_phone text,
  notes text,
  quoted_price bigint not null,
  appointment_start_at timestamptz not null,
  appointment_end_at timestamptz not null,
  status text not null,
  expires_at timestamptz,
  professional_id uuid references professionals(id),
  patient_id uuid references patients(id),
  appointment_id uuid references appointments(id),
  payment_id uuid,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_public_booking_org_site_start
  on public_bookings(organization_id, site_id, appointment_start_at);

create index if not exists idx_public_booking_prof_start
  on public_bookings(professional_id, appointment_start_at);

create table if not exists public_payments (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  booking_id uuid not null references public_bookings(id) on delete cascade,
  provider_key text not null,
  provider_reference text not null,
  provider_status text,
  amount bigint not null,
  currency text not null,
  status text not null,
  idempotency_key text,
  paid_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists uq_public_payments_provider_reference
  on public_payments(provider_reference);

create index if not exists idx_public_payments_booking
  on public_payments(booking_id, created_at desc);

alter table public_bookings
  add constraint fk_public_bookings_payment
  foreign key (payment_id) references public_payments(id);

create table if not exists public_notification_logs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  booking_id uuid not null references public_bookings(id) on delete cascade,
  channel text not null,
  recipient text,
  template_code text not null,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_public_notification_booking
  on public_notification_logs(booking_id, created_at desc);
