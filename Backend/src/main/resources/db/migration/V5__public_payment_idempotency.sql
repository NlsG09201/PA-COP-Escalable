alter table public_payments
  add column if not exists expires_at timestamptz;

alter table public_payments
  add column if not exists last_webhook_idempotency_key text;

create index if not exists idx_public_payments_booking_idempotency
  on public_payments(booking_id, idempotency_key, created_at desc);
