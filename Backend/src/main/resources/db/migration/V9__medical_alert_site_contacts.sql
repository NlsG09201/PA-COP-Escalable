create table if not exists notification_medical_alert_contacts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  audience text not null,
  channel text not null,
  address text not null,
  label text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint chk_medical_alert_contact_audience check (audience in ('PROFESSIONALS', 'ADMINS')),
  constraint chk_medical_alert_contact_channel check (channel in ('EMAIL', 'WHATSAPP'))
);

create unique index if not exists uk_notification_medical_alert_contact_address
  on notification_medical_alert_contacts(organization_id, site_id, audience, channel, address);

create index if not exists idx_notification_medical_alert_contacts_site
  on notification_medical_alert_contacts(organization_id, site_id);
