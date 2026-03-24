-- Longitudinal clinical support: dental treatment plans, visual metadata, psychology episodes,
-- structured session notes, risk assessments, and cross-cutting follow-up tasks.
-- Multi-tenant: organization_id + site_id (aligned with patients / appointments).

-- ---------------------------------------------------------------------------
-- Psychology: therapy episode (container for goals and session series)
-- ---------------------------------------------------------------------------
create table if not exists psych_therapy_episodes (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  status text not null,
  presenting_problem text,
  clinical_formulation text,
  goals_json jsonb,
  discharge_criteria text,
  opened_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_psych_episodes_patient
  on psych_therapy_episodes(organization_id, site_id, patient_id, opened_at desc);

-- ---------------------------------------------------------------------------
-- Dental: treatment plan and steps (odontogram / plan state lives in rows)
-- ---------------------------------------------------------------------------
create table if not exists dental_treatment_plans (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  status text not null,
  title text,
  notes text,
  started_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_dental_plans_patient
  on dental_treatment_plans(organization_id, site_id, patient_id, started_at desc);

create table if not exists dental_treatment_steps (
  id uuid primary key,
  plan_id uuid not null references dental_treatment_plans(id) on delete cascade,
  tooth_fdi text,
  surfaces text,
  procedure_code text not null,
  status text not null,
  sort_order integer not null default 0,
  depends_on_step_id uuid references dental_treatment_steps(id) on delete set null,
  target_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_dental_steps_plan
  on dental_treatment_steps(plan_id, sort_order);
create index if not exists idx_dental_steps_status
  on dental_treatment_steps(plan_id, status);

-- ---------------------------------------------------------------------------
-- Psychology: per-session structured note (links optional appointment)
-- ---------------------------------------------------------------------------
create table if not exists psych_session_notes (
  id uuid primary key,
  episode_id uuid not null references psych_therapy_episodes(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  appointment_id uuid references appointments(id) on delete set null,
  session_at timestamptz not null,
  mood_scale integer,
  risk_level text,
  structured_summary jsonb,
  narrative text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_psych_sessions_episode
  on psych_session_notes(episode_id, session_at desc);
create index if not exists idx_psych_sessions_patient
  on psych_session_notes(organization_id, site_id, patient_id, session_at desc);

-- ---------------------------------------------------------------------------
-- Psychology: formal risk snapshot (instrument + level + next review)
-- ---------------------------------------------------------------------------
create table if not exists psych_risk_assessments (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  episode_id uuid references psych_therapy_episodes(id) on delete set null,
  instrument_code text not null,
  score numeric,
  level text not null,
  assessed_at timestamptz not null,
  next_review_at timestamptz,
  notes text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_psych_risk_patient
  on psych_risk_assessments(organization_id, site_id, patient_id, assessed_at desc);
create index if not exists idx_psych_risk_next_review
  on psych_risk_assessments(organization_id, site_id, next_review_at)
  where next_review_at is not null;

-- ---------------------------------------------------------------------------
-- Dental: visual artifact metadata (binary in object storage; key stored here)
-- ---------------------------------------------------------------------------
create table if not exists dental_visual_artifacts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  tooth_fdi text,
  artifact_type text not null,
  storage_key text not null,
  content_hash text,
  captured_at timestamptz not null,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_dental_visual_patient
  on dental_visual_artifacts(organization_id, site_id, patient_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- Cross-cutting follow-up tasks (dental step, psych episode, or appointment)
-- ---------------------------------------------------------------------------
create table if not exists clinical_follow_up_tasks (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  patient_id uuid not null references patients(id),
  task_type text not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  status text not null default 'PENDING',
  assigned_to_professional_id uuid references professionals(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  dental_step_id uuid references dental_treatment_steps(id) on delete set null,
  psych_episode_id uuid references psych_therapy_episodes(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_follow_up_due
  on clinical_follow_up_tasks(organization_id, site_id, status, due_at);
create index if not exists idx_follow_up_patient
  on clinical_follow_up_tasks(organization_id, site_id, patient_id, due_at);
