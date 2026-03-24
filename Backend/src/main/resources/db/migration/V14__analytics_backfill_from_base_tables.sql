-- Backfill analytics rollups from base transactional tables.
-- Useful after bulk imports that bypass domain events.

insert into analytics_daily_site_metrics (
  organization_id, site_id, day,
  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
  patients_new, revenue_paid_cents, booked_minutes
)
select
  a.organization_id,
  a.site_id,
  (a.start_at at time zone 'UTC')::date as day,
  count(*)::bigint as appointments_created,
  count(*) filter (where a.status = 'CONFIRMED')::bigint as appointments_confirmed,
  count(*) filter (where a.status = 'CANCELLED')::bigint as appointments_cancelled,
  count(*) filter (where a.status = 'COMPLETED')::bigint as appointments_completed,
  0::bigint as patients_new,
  0::bigint as revenue_paid_cents,
  coalesce(sum(greatest(0, extract(epoch from (a.end_at - a.start_at)) / 60)), 0)::bigint as booked_minutes
from appointments a
group by a.organization_id, a.site_id, (a.start_at at time zone 'UTC')::date
on conflict (organization_id, site_id, day) do update set
  appointments_created = excluded.appointments_created,
  appointments_confirmed = excluded.appointments_confirmed,
  appointments_cancelled = excluded.appointments_cancelled,
  appointments_completed = excluded.appointments_completed,
  revenue_paid_cents = excluded.revenue_paid_cents,
  booked_minutes = excluded.booked_minutes;

insert into analytics_daily_site_metrics (
  organization_id, site_id, day,
  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
  patients_new, revenue_paid_cents, booked_minutes
)
select
  p.organization_id,
  p.site_id,
  (p.created_at at time zone 'UTC')::date as day,
  0::bigint, 0::bigint, 0::bigint, 0::bigint,
  count(*)::bigint as patients_new,
  0::bigint, 0::bigint
from patients p
group by p.organization_id, p.site_id, (p.created_at at time zone 'UTC')::date
on conflict (organization_id, site_id, day) do update set
  patients_new = excluded.patients_new;

insert into analytics_daily_specialty_metrics (
  organization_id, site_id, day, specialty,
  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
  revenue_paid_cents, booked_minutes
)
select
  a.organization_id,
  a.site_id,
  (a.start_at at time zone 'UTC')::date as day,
  coalesce(nullif(trim(pr.specialty), ''), '_DESCONOCIDO_') as specialty,
  count(*)::bigint as appointments_created,
  count(*) filter (where a.status = 'CONFIRMED')::bigint as appointments_confirmed,
  count(*) filter (where a.status = 'CANCELLED')::bigint as appointments_cancelled,
  count(*) filter (where a.status = 'COMPLETED')::bigint as appointments_completed,
  0::bigint as revenue_paid_cents,
  coalesce(sum(greatest(0, extract(epoch from (a.end_at - a.start_at)) / 60)), 0)::bigint as booked_minutes
from appointments a
left join professionals pr on pr.id = a.professional_id
group by a.organization_id, a.site_id, (a.start_at at time zone 'UTC')::date, coalesce(nullif(trim(pr.specialty), ''), '_DESCONOCIDO_')
on conflict (organization_id, site_id, day, specialty) do update set
  appointments_created = excluded.appointments_created,
  appointments_confirmed = excluded.appointments_confirmed,
  appointments_cancelled = excluded.appointments_cancelled,
  appointments_completed = excluded.appointments_completed,
  revenue_paid_cents = excluded.revenue_paid_cents,
  booked_minutes = excluded.booked_minutes;

insert into analytics_daily_professional_metrics (
  organization_id, site_id, day, professional_id,
  appointments_created, appointments_confirmed, appointments_cancelled, appointments_completed,
  revenue_paid_cents, booked_minutes
)
select
  a.organization_id,
  a.site_id,
  (a.start_at at time zone 'UTC')::date as day,
  a.professional_id,
  count(*)::bigint as appointments_created,
  count(*) filter (where a.status = 'CONFIRMED')::bigint as appointments_confirmed,
  count(*) filter (where a.status = 'CANCELLED')::bigint as appointments_cancelled,
  count(*) filter (where a.status = 'COMPLETED')::bigint as appointments_completed,
  0::bigint as revenue_paid_cents,
  coalesce(sum(greatest(0, extract(epoch from (a.end_at - a.start_at)) / 60)), 0)::bigint as booked_minutes
from appointments a
group by a.organization_id, a.site_id, (a.start_at at time zone 'UTC')::date, a.professional_id
on conflict (organization_id, site_id, day, professional_id) do update set
  appointments_created = excluded.appointments_created,
  appointments_confirmed = excluded.appointments_confirmed,
  appointments_cancelled = excluded.appointments_cancelled,
  appointments_completed = excluded.appointments_completed,
  revenue_paid_cents = excluded.revenue_paid_cents,
  booked_minutes = excluded.booked_minutes;
