-- ============================================================
-- V16: Follow-up post-treatment & smart budget tables
-- ============================================================

-- Follow-up surveys
CREATE TABLE IF NOT EXISTS followup_surveys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    treatment_type  VARCHAR(50) NOT NULL,
    trigger_event   VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    scheduled_at    TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    score           NUMERIC(5,2),
    risk_detected   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_surveys_patient ON followup_surveys(organization_id, site_id, patient_id);
CREATE INDEX idx_followup_surveys_status ON followup_surveys(status, scheduled_at);

-- Follow-up survey questions
CREATE TABLE IF NOT EXISTS followup_survey_questions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id   UUID NOT NULL REFERENCES followup_surveys(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT,
    score       NUMERIC(5,2),
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_followup_questions_survey ON followup_survey_questions(survey_id);

-- Follow-up scheduled control appointments
CREATE TABLE IF NOT EXISTS followup_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    survey_id       UUID REFERENCES followup_surveys(id),
    appointment_id  UUID,
    reason          TEXT NOT NULL,
    scheduled_date  DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_schedules_patient ON followup_schedules(organization_id, site_id, patient_id);

-- Clinical budgets
CREATE TABLE IF NOT EXISTS clinical_budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'COP',
    estimated_days  INT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_budgets_patient ON clinical_budgets(organization_id, site_id, patient_id);

-- Budget phases
CREATE TABLE IF NOT EXISTS budget_phases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id   UUID NOT NULL REFERENCES clinical_budgets(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    phase_order INT NOT NULL DEFAULT 0,
    cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
    duration_days INT,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX idx_budget_phases_budget ON budget_phases(budget_id);

-- Budget phase items
CREATE TABLE IF NOT EXISTS budget_phase_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id    UUID NOT NULL REFERENCES budget_phases(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    tooth_code  VARCHAR(10),
    quantity    INT NOT NULL DEFAULT 1,
    unit_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost  NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_budget_items_phase ON budget_phase_items(phase_id);

-- Payment plans
CREATE TABLE IF NOT EXISTS payment_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id       UUID NOT NULL REFERENCES clinical_budgets(id) ON DELETE CASCADE,
    plan_type       VARCHAR(30) NOT NULL,
    num_installments INT NOT NULL DEFAULT 1,
    interest_rate   NUMERIC(5,4) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment installments
CREATE TABLE IF NOT EXISTS payment_installments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
    installment_num INT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    due_date        DATE NOT NULL,
    paid_at         TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX idx_payment_installments_plan ON payment_installments(plan_id);
CREATE INDEX idx_payment_installments_due ON payment_installments(status, due_date);
