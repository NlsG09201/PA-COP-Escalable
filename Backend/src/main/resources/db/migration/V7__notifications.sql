create table if not exists notification_outbox_messages (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  appointment_id uuid references appointments(id) on delete cascade,
  patient_id uuid not null references patients(id),
  event_type text not null,
  payload text not null,
  status text not null,
  relay_attempt_count integer not null default 0,
  next_relay_attempt_at timestamptz not null,
  last_published_at timestamptz,
  relay_error_message text,
  delivery_retry_at timestamptz,
  delivery_error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create unique index if not exists uk_notification_outbox_appointment_event
  on notification_outbox_messages(appointment_id, event_type);
create index if not exists idx_notification_outbox_relay
  on notification_outbox_messages(status, next_relay_attempt_at);
create index if not exists idx_notification_outbox_delivery_retry
  on notification_outbox_messages(delivery_retry_at)
  where delivery_retry_at is not null;

create table if not exists notification_deliveries (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  outbox_message_id uuid not null references notification_outbox_messages(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete cascade,
  patient_id uuid not null references patients(id),
  event_type text not null,
  audience text not null,
  channel text not null,
  recipient text not null,
  template_code text not null,
  subject text,
  message_body text not null,
  status text not null,
  attempt_count integer not null default 0,
  provider_message_id text,
  error_message text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create unique index if not exists uk_notification_delivery_target
  on notification_deliveries(outbox_message_id, channel, audience, recipient);
create index if not exists idx_notification_deliveries_status_next_attempt
  on notification_deliveries(status, next_attempt_at);
create index if not exists idx_notification_deliveries_appointment
  on notification_deliveries(appointment_id, created_at desc);
