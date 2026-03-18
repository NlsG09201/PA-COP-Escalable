-- ============================================================================
-- Production schema for a dental and psychological center
-- Target engine: PostgreSQL 16+
-- Execution mode: psql
-- ============================================================================

CREATE DATABASE cop_clinic;
\connect cop_clinic;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- Catalogs and tenant roots
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug CITEXT NOT NULL UNIQUE,
  legal_name VARCHAR(200) NOT NULL,
  tax_id VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(80),
  state_region VARCHAR(80),
  postal_code VARCHAR(20),
  phone VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sites_org_code UNIQUE (organization_id, code)
);

CREATE INDEX idx_sites_org_status ON sites (organization_id, status);

CREATE TABLE roles (
  code VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(250)
);

INSERT INTO roles (code, name, description) VALUES
  ('ADMIN', 'Administrador global', 'Administra operacion y configuracion'),
  ('DENTIST', 'Odontologo', 'Profesional odontologico'),
  ('PSYCHOLOGIST', 'Psicologo', 'Profesional psicologico'),
  ('RECEPTIONIST', 'Recepcion', 'Gestion operativa de agenda'),
  ('ORG_ADMIN', 'Administrador organizacional', 'Gestiona una organizacion'),
  ('SITE_ADMIN', 'Administrador de sede', 'Gestiona una sede')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Security and staff
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  username CITEXT NOT NULL,
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_org_username UNIQUE (organization_id, username),
  CONSTRAINT uq_users_org_email UNIQUE (organization_id, email)
);

CREATE INDEX idx_users_org_status ON users (organization_id, status);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code VARCHAR(40) NOT NULL REFERENCES roles(code),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  issued_from_ip INET,
  user_agent VARCHAR(512),
  CONSTRAINT ck_refresh_tokens_expiry CHECK (expires_at > issued_at)
);

CREATE INDEX idx_refresh_tokens_user_active
  ON refresh_tokens (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  area VARCHAR(30) NOT NULL
    CHECK (area IN ('DENTAL', 'PSYCHOLOGY', 'ADMINISTRATIVE')),
  description VARCHAR(250),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_specialties_org_code UNIQUE (organization_id, code)
);

CREATE INDEX idx_specialties_org_active ON specialties (organization_id, active);

CREATE TABLE professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(30),
  license_number VARCHAR(60),
  document_type VARCHAR(20),
  document_number VARCHAR(30),
  default_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_prof_profiles_org_employee UNIQUE (organization_id, employee_code),
  CONSTRAINT uq_prof_profiles_org_license UNIQUE (organization_id, license_number)
);

CREATE INDEX idx_prof_profiles_org_status ON professional_profiles (organization_id, status);

CREATE TABLE professional_specialties (
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (professional_id, specialty_id)
);

CREATE UNIQUE INDEX uq_prof_primary_specialty
  ON professional_specialties (professional_id)
  WHERE is_primary;

CREATE TABLE professional_site_assignments (
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  accepts_public_bookings BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (professional_id, site_id)
);

CREATE INDEX idx_prof_site_assignments_site_active
  ON professional_site_assignments (site_id, active, accepts_public_bookings);

-- ============================================================================
-- Service catalog and patients
-- ============================================================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  promo_price_cents INTEGER CHECK (promo_price_cents IS NULL OR promo_price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_services_org_code UNIQUE (organization_id, code),
  CONSTRAINT ck_services_price_order CHECK (
    promo_price_cents IS NULL OR promo_price_cents <= base_price_cents
  )
);

CREATE INDEX idx_services_org_specialty_active
  ON services (organization_id, specialty_id, active);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  patient_code VARCHAR(30),
  document_type VARCHAR(20),
  document_number VARCHAR(30),
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80),
  last_name VARCHAR(80) NOT NULL,
  second_last_name VARCHAR(80),
  birth_date DATE,
  sex_at_birth VARCHAR(20)
    CHECK (sex_at_birth IN ('FEMALE', 'MALE', 'INTERSEX', 'UNKNOWN')),
  phone VARCHAR(30),
  email CITEXT,
  preferred_contact_channel VARCHAR(20)
    CHECK (preferred_contact_channel IN ('PHONE', 'EMAIL', 'WHATSAPP', 'SMS')),
  blood_type VARCHAR(3),
  insurance_provider VARCHAR(120),
  occupation VARCHAR(120),
  notes VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_patients_org_code UNIQUE (organization_id, patient_code),
  CONSTRAINT uq_patients_org_document UNIQUE (organization_id, document_type, document_number)
);

CREATE INDEX idx_patients_org_site_status ON patients (organization_id, site_id, status);
CREATE INDEX idx_patients_org_name ON patients (organization_id, last_name, first_name);

CREATE TABLE patient_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  contact_type VARCHAR(20) NOT NULL
    CHECK (contact_type IN ('PRIMARY', 'EMERGENCY', 'GUARDIAN', 'BILLING')),
  full_name VARCHAR(160) NOT NULL,
  relationship VARCHAR(80),
  phone VARCHAR(30),
  email CITEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_patient_primary_contact
  ON patient_contacts (patient_id)
  WHERE is_primary;

-- ============================================================================
-- Appointments
-- ============================================================================

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE RESTRICT,
  source_channel VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
    CHECK (source_channel IN ('INTERNAL', 'PUBLIC_WEB', 'PHONE', 'WHATSAPP')),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(500),
  cancellation_reason VARCHAR(500),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_appointments_time CHECK (end_at > start_at)
);

CREATE INDEX idx_appointments_patient_time ON appointments (patient_id, start_at DESC);
CREATE INDEX idx_appointments_professional_time ON appointments (professional_id, start_at);
CREATE INDEX idx_appointments_site_time_status ON appointments (site_id, start_at, status);

ALTER TABLE appointments
  ADD CONSTRAINT ex_appointments_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));

CREATE TABLE appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN ('CREATED', 'CONFIRMED', 'RESCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note VARCHAR(500),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointment_events_appointment_time
  ON appointment_events (appointment_id, occurred_at DESC);

-- ============================================================================
-- Public booking and payment module
-- ============================================================================

CREATE TABLE public_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES professional_profiles(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  service_name VARCHAR(150) NOT NULL,
  service_category VARCHAR(120) NOT NULL,
  patient_name VARCHAR(160) NOT NULL,
  patient_email CITEXT NOT NULL,
  patient_phone VARCHAR(30) NOT NULL,
  notes VARCHAR(500),
  quoted_price_cents INTEGER NOT NULL CHECK (quoted_price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  appointment_start_at TIMESTAMPTZ NOT NULL,
  appointment_end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (status IN ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_public_bookings_time CHECK (appointment_end_at > appointment_start_at),
  CONSTRAINT ck_public_bookings_expiry CHECK (expires_at >= created_at)
);

CREATE INDEX idx_public_bookings_site_window
  ON public_bookings (site_id, appointment_start_at, status);
CREATE INDEX idx_public_bookings_patient_email
  ON public_bookings (organization_id, patient_email, created_at DESC);

CREATE TABLE public_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public_bookings(id) ON DELETE CASCADE,
  provider_key VARCHAR(30) NOT NULL,
  provider_reference VARCHAR(120) NOT NULL,
  provider_status VARCHAR(50) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
  checkout_url TEXT,
  client_secret TEXT,
  failure_reason VARCHAR(500),
  idempotency_key VARCHAR(120) NOT NULL,
  last_webhook_idempotency_key VARCHAR(120),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_public_payments_provider_reference UNIQUE (provider_key, provider_reference)
);

CREATE INDEX idx_public_payments_booking_created
  ON public_payments (booking_id, created_at DESC);
CREATE INDEX idx_public_payments_booking_idempotency
  ON public_payments (booking_id, idempotency_key, created_at DESC);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public_bookings(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS')),
  recipient VARCHAR(160) NOT NULL,
  template_code VARCHAR(80),
  template_payload JSONB,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  provider_message_id VARCHAR(120),
  error_message VARCHAR(500),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_deliveries_booking_created
  ON notification_deliveries (booking_id, created_at DESC);

-- ============================================================================
-- Optional audit table
-- ============================================================================

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_name VARCHAR(120) NOT NULL,
  entity_id UUID,
  action VARCHAR(40) NOT NULL,
  before_state JSONB,
  after_state JSONB,
  source_ip INET,
  user_agent VARCHAR(512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_time ON audit_log (organization_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_name, entity_id, created_at DESC);

