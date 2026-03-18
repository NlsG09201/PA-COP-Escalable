alter table public_payments
  add column if not exists checkout_url text;

alter table public_payments
  add column if not exists client_secret text;

alter table public_payments
  add column if not exists failure_reason text;

create index if not exists idx_public_payments_booking_provider
  on public_payments(booking_id, provider_key, created_at desc);

create index if not exists idx_public_payments_booking_provider_idempotency
  on public_payments(booking_id, provider_key, idempotency_key, created_at desc);
