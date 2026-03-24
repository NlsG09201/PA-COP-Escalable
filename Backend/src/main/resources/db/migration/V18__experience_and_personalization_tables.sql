-- ============================================================
-- V18: Patient experience, satisfaction & personalization
-- ============================================================

-- Satisfaction surveys (NPS + custom)
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    survey_type     VARCHAR(30) NOT NULL DEFAULT 'NPS',
    trigger_event   VARCHAR(100),
    nps_score       INT CHECK (nps_score >= 0 AND nps_score <= 10),
    satisfaction    NUMERIC(5,2),
    feedback_text   TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at         TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_satisfaction_surveys_patient ON satisfaction_surveys(organization_id, site_id, patient_id);
CREATE INDEX idx_satisfaction_surveys_date ON satisfaction_surveys(organization_id, site_id, created_at DESC);

-- Satisfaction survey questions
CREATE TABLE IF NOT EXISTS satisfaction_questions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id   UUID NOT NULL REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer_type VARCHAR(20) NOT NULL DEFAULT 'SCALE',
    answer      TEXT,
    score       NUMERIC(5,2),
    sort_order  INT NOT NULL DEFAULT 0
);

-- Churn predictions
CREATE TABLE IF NOT EXISTS churn_predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    churn_score     NUMERIC(5,4) NOT NULL,
    risk_level      VARCHAR(20) NOT NULL,
    factors_json    JSONB NOT NULL DEFAULT '[]',
    actions_json    JSONB NOT NULL DEFAULT '[]',
    model_version   VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_churn_predictions_patient ON churn_predictions(organization_id, site_id, patient_id);
CREATE INDEX idx_churn_predictions_risk ON churn_predictions(risk_level, created_at DESC);

-- Patient portal access tokens
CREATE TABLE IF NOT EXISTS portal_access_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    token_hash      VARCHAR(128) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    last_used_at    TIMESTAMPTZ,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_tokens_patient ON portal_access_tokens(patient_id);
CREATE INDEX idx_portal_tokens_hash ON portal_access_tokens(token_hash) WHERE active = TRUE;

-- Copilot session summaries
CREATE TABLE IF NOT EXISTS copilot_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    professional_id UUID NOT NULL,
    session_type    VARCHAR(50) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    summary_text    TEXT,
    suggestions_json JSONB DEFAULT '[]',
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_copilot_sessions_patient ON copilot_sessions(organization_id, site_id, patient_id);
CREATE INDEX idx_copilot_sessions_professional ON copilot_sessions(professional_id, started_at DESC);

-- Clinical decision log
CREATE TABLE IF NOT EXISTS clinical_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    decision_type   VARCHAR(50) NOT NULL,
    input_json      JSONB NOT NULL DEFAULT '{}',
    output_json     JSONB NOT NULL DEFAULT '{}',
    model_version   VARCHAR(50),
    accepted        BOOLEAN,
    accepted_by     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_decisions_patient ON clinical_decisions(organization_id, site_id, patient_id);

-- Performance indexes for all new tables
CREATE INDEX idx_therapy_sessions_completed ON therapy_sessions(patient_id, status) WHERE status = 'COMPLETED';
CREATE INDEX idx_followup_surveys_risk ON followup_surveys(risk_detected, created_at DESC) WHERE risk_detected = TRUE;
