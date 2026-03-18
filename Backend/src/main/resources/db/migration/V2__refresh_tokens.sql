create table if not exists refresh_tokens (
  id uuid primary key,
  organization_id uuid not null,
  site_id uuid,
  user_id uuid not null,
  token_hash text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid,
  ip text,
  user_agent text
);

create index if not exists idx_refresh_token_hash on refresh_tokens(token_hash);
create index if not exists idx_refresh_user on refresh_tokens(user_id, expires_at desc);
