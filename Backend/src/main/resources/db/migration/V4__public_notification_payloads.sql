alter table public_notification_logs
  add column if not exists attempt_count integer not null default 1;

alter table public_notification_logs
  add column if not exists template_payload text;
