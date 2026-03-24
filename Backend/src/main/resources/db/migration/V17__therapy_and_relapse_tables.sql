-- ============================================================
-- V17: Digital therapy & relapse prediction tables
-- ============================================================

-- Therapy module library
CREATE TABLE IF NOT EXISTS therapy_modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) NOT NULL,
    difficulty      VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    duration_min    INT NOT NULL DEFAULT 10,
    content_json    JSONB NOT NULL DEFAULT '{}',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed therapy modules
INSERT INTO therapy_modules (code, name, description, category, difficulty, duration_min, content_json) VALUES
('BREATHING_478', 'Respiracion 4-7-8', 'Tecnica de respiracion para reducir ansiedad. Inhalar 4s, sostener 7s, exhalar 8s.', 'BREATHING', 'BEGINNER', 5,
 '{"type":"breathing","phases":[{"name":"inhale","duration":4},{"name":"hold","duration":7},{"name":"exhale","duration":8}],"cycles":4}'::jsonb),
('BREATHING_BOX', 'Respiracion Cuadrada', 'Tecnica de box breathing. Inhalar, sostener, exhalar, sostener, 4s cada fase.', 'BREATHING', 'BEGINNER', 5,
 '{"type":"breathing","phases":[{"name":"inhale","duration":4},{"name":"hold","duration":4},{"name":"exhale","duration":4},{"name":"hold","duration":4}],"cycles":4}'::jsonb),
('MINDFULNESS_BODY_SCAN', 'Body Scan', 'Escaneo corporal progresivo para conciencia somatica y relajacion.', 'MINDFULNESS', 'INTERMEDIATE', 15,
 '{"type":"guided","sections":["feet","legs","abdomen","chest","arms","head"],"instruction_per_section":"Focus attention on this area for 2 minutes"}'::jsonb),
('CBT_THOUGHT_RECORD', 'Registro de Pensamientos', 'Ejercicio CBT para identificar y reestructurar pensamientos automaticos negativos.', 'CBT', 'INTERMEDIATE', 20,
 '{"type":"form","fields":["situation","automatic_thought","emotion","evidence_for","evidence_against","balanced_thought","outcome_emotion"]}'::jsonb),
('JOURNALING_FREE', 'Diario Libre', 'Escritura libre reflexiva para procesamiento emocional.', 'JOURNALING', 'BEGINNER', 15,
 '{"type":"journaling","prompts":["¿Como te sientes hoy?","¿Que situacion te ha generado mas impacto esta semana?","¿Que agradeces hoy?"]}'::jsonb),
('JOURNALING_GRATITUDE', 'Diario de Gratitud', 'Practica diaria de gratitud para mejorar bienestar.', 'JOURNALING', 'BEGINNER', 10,
 '{"type":"journaling","prompts":["Escribe 3 cosas por las que estas agradecido hoy","¿Quien hizo algo amable por ti recientemente?","¿Que momento positivo recuerdas de hoy?"]}'::jsonb),
('PMR_FULL', 'Relajacion Muscular Progresiva', 'Tecnica de tension-relajacion para grupos musculares principales.', 'RELAXATION', 'BEGINNER', 20,
 '{"type":"guided","muscle_groups":["hands","forearms","biceps","shoulders","neck","face","chest","abdomen","thighs","calves","feet"],"tension_sec":5,"relax_sec":15}'::jsonb),
('EXPOSURE_HIERARCHY', 'Jerarquia de Exposicion', 'Construccion de jerarquia de situaciones para exposicion gradual.', 'CBT', 'ADVANCED', 30,
 '{"type":"form","fields":["feared_situation","anxiety_rating_0_10","approach_step_1","approach_step_2","approach_step_3","coping_strategy"]}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Therapy sessions (patient progress)
CREATE TABLE IF NOT EXISTS therapy_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    module_id       UUID NOT NULL REFERENCES therapy_modules(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    score           NUMERIC(5,2),
    duration_sec    INT,
    responses_json  JSONB DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_therapy_sessions_patient ON therapy_sessions(organization_id, site_id, patient_id);
CREATE INDEX idx_therapy_sessions_module ON therapy_sessions(module_id);
CREATE INDEX idx_therapy_sessions_date ON therapy_sessions(patient_id, created_at DESC);

-- Relapse alerts
CREATE TABLE IF NOT EXISTS relapse_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    site_id         UUID NOT NULL,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    risk_score      NUMERIC(5,4) NOT NULL,
    risk_level      VARCHAR(20) NOT NULL,
    factors_json    JSONB NOT NULL DEFAULT '[]',
    actions_json    JSONB NOT NULL DEFAULT '[]',
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relapse_alerts_patient ON relapse_alerts(organization_id, site_id, patient_id);
CREATE INDEX idx_relapse_alerts_level ON relapse_alerts(risk_level, acknowledged, created_at DESC);
