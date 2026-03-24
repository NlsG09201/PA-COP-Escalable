-- Hotfix: ensure appointment snapshot columns required by current domain model.
-- Safe to run multiple times.

alter table if exists appointments
  add column if not exists service_offering_id uuid references service_offerings(id);

alter table if exists appointments
  add column if not exists service_name_snapshot text;

alter table if exists appointments
  add column if not exists service_category_snapshot text;
