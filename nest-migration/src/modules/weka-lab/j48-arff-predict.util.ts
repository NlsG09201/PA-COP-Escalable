import { ClinicalPredictDto } from './dto/clinical-predict.dto';

/** Atributos de relapse_risk_j48.arff */
export const ARFF_DATASET_SCHEMA = {
  id: 'builtin-arff',
  filename: 'relapse_risk_j48.arff',
  displayName: 'Riesgo de recaída (J48 / ARFF COP)',
  rows: 15_000,
  target: 'risk_level',
  classLabels: ['LOW', 'MEDIUM', 'HIGH'] as const,
  features: [
    { key: 'gender', label: 'Género', type: 'nominal', options: ['M', 'F', 'O'] },
    { key: 'age_group', label: 'Grupo de edad', type: 'nominal', options: ['YOUNG_ADULT', 'ADULT', 'SENIOR'] },
    { key: 'sentiment', label: 'Sentimiento', type: 'nominal', options: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    { key: 'wellbeing', label: 'Bienestar', type: 'nominal', options: ['HIGH', 'MEDIUM', 'LOW'] },
    { key: 'anxiety', label: 'Ansiedad (0–1)', type: 'numeric', min: 0, max: 1 },
    { key: 'depression', label: 'Depresión (0–1)', type: 'numeric', min: 0, max: 1 },
    { key: 'attendance', label: 'Asistencia', type: 'nominal', options: ['REGULAR', 'IRREGULAR'] },
    { key: 'days_since_last', label: 'Días sin última sesión', type: 'numeric', min: 0, max: 90 },
  ],
};

export type ClinicalPredictionResult = {
  modelId: string;
  classLabel: string;
  probabilities: Record<string, number>;
  relapseProbability: number;
  riskLevel: string;
  riskScore: number;
  psychologicalScore: number;
  alertLevel: 'CRITICAL' | 'WARNING' | 'NORMAL';
  recommendations: string[];
  featuresUsed: Record<string, unknown>;
  offline?: boolean;
  datasetId?: string;
};

function mapGender(raw?: string): string {
  const s = String(raw ?? 'F').trim().toUpperCase();
  if (s === 'M' || s === 'MALE' || s === 'MASCULINO') return 'M';
  if (s === 'O' || s === 'OTHER' || s === 'OTRO') return 'O';
  return 'F';
}

function mapAgeGroup(raw?: string): string {
  const s = String(raw ?? 'ADULT').trim().toUpperCase();
  if (s.includes('YOUNG') || s.includes('JOVEN')) return 'YOUNG_ADULT';
  if (s.includes('SENIOR') || s.includes('MAYOR')) return 'SENIOR';
  return 'ADULT';
}

function mapSentiment(raw?: string): string {
  const s = String(raw ?? 'NEUTRAL').trim().toUpperCase();
  if (s.startsWith('POS')) return 'POSITIVE';
  if (s.startsWith('NEG')) return 'NEGATIVE';
  return 'NEUTRAL';
}

function mapWellbeing(raw?: string): string {
  const s = String(raw ?? 'MEDIUM').trim().toUpperCase();
  if (s === 'HIGH' || s === 'ALTO') return 'HIGH';
  if (s === 'LOW' || s === 'BAJO') return 'LOW';
  if (s === 'MODERATE' || s === 'MODERADO') return 'MEDIUM';
  return 'MEDIUM';
}

function mapAttendance(raw?: string): string {
  const s = String(raw ?? 'REGULAR').trim().toUpperCase();
  if (s.includes('IRREG') || s === 'ABSENT' || s === 'AUSENTE') return 'IRREGULAR';
  return 'REGULAR';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Normaliza el DTO del formulario a columnas del ARFF. */
export function normalizeArffFeatures(dto: ClinicalPredictDto): Record<string, unknown> {
  const anxiety = dto.anxiety == null ? 0.5 : clamp01(Number(dto.anxiety));
  const depression = dto.depression == null ? 0.4 : clamp01(Number(dto.depression));
  const days = dto.days_since_last == null ? 14 : Math.max(0, Math.min(365, Number(dto.days_since_last)));

  return {
    gender: mapGender(dto.gender),
    age_group: mapAgeGroup(dto.age_group),
    sentiment: mapSentiment(dto.sentiment),
    wellbeing: mapWellbeing(dto.wellbeing),
    anxiety,
    depression,
    attendance: mapAttendance(dto.attendance),
    days_since_last: days,
  };
}

/** Heurística alineada con risk_level {LOW, MEDIUM, HIGH} cuando J48 Python no responde. */
export function offlineArffPredict(features: Record<string, unknown>): {
  classLabel: string;
  probabilities: Record<string, number>;
} {
  let score = 0.28;
  if (features.sentiment === 'NEGATIVE') score += 0.22;
  if (features.wellbeing === 'LOW') score += 0.18;
  if (features.attendance === 'IRREGULAR') score += 0.14;
  const days = Number(features.days_since_last);
  if (Number.isFinite(days) && days > 45) score += 0.1;
  const anx = Number(features.anxiety);
  const dep = Number(features.depression);
  if (Number.isFinite(anx)) score += anx * 0.14;
  if (Number.isFinite(dep)) score += dep * 0.14;
  score = Math.min(0.95, Math.max(0.05, score));

  const classLabel = score >= 0.68 ? 'HIGH' : score >= 0.42 ? 'MEDIUM' : 'LOW';
  const probabilities: Record<string, number> = {
    LOW: classLabel === 'LOW' ? 0.55 + (1 - score) * 0.3 : Math.max(0.05, 0.35 - score * 0.2),
    MEDIUM: classLabel === 'MEDIUM' ? 0.5 + score * 0.2 : 0.25,
    HIGH: classLabel === 'HIGH' ? 0.5 + score * 0.35 : Math.max(0.05, score * 0.35),
  };
  const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(probabilities)) {
    probabilities[k] = Math.round((probabilities[k] / sum) * 10000) / 10000;
  }
  return { classLabel, probabilities };
}

function riskScoreFromProbs(probabilities: Record<string, number>): number {
  const weights: Record<string, number> = { LOW: 0.2, MEDIUM: 0.55, HIGH: 0.9 };
  return Math.round(
    Object.entries(probabilities).reduce((acc, [k, v]) => acc + (weights[k] ?? 0.5) * v, 0) * 10000,
  ) / 10000;
}

function alertLevel(label: string, score: number): ClinicalPredictionResult['alertLevel'] {
  if (label === 'HIGH' || score >= 0.75) return 'CRITICAL';
  if (label === 'MEDIUM' || score >= 0.45) return 'WARNING';
  return 'NORMAL';
}

function clinicalRecommendations(label: string, features: Record<string, unknown>): string[] {
  const recs: string[] = [];
  if (label === 'MEDIUM' || label === 'HIGH') {
    recs.push('Programar sesión de seguimiento en los próximos 7 días.');
  }
  if (features.attendance === 'IRREGULAR') {
    recs.push('Reforzar adherencia terapéutica con recordatorios automáticos.');
  }
  const anxiety = Number(features.anxiety);
  const depression = Number(features.depression);
  if (Number.isFinite(anxiety) && anxiety >= 0.7) {
    recs.push('Evaluar escalas de ansiedad (GAD-7) y técnicas de regulación emocional.');
  }
  if (Number.isFinite(depression) && depression >= 0.7) {
    recs.push('Valorar interconsulta psiquiátrica y plan de crisis.');
  }
  if (!recs.length) {
    recs.push('Continuar plan terapéutico actual; próxima evaluación en 30 días.');
  }
  return recs;
}

export function toClinicalPrediction(
  raw: {
    classLabel?: string;
    probabilities?: Record<string, number>;
    riskScore?: number;
    alertLevel?: string;
    recommendations?: string[];
  },
  modelId: string,
  featuresUsed: Record<string, unknown>,
  opts?: { offline?: boolean },
): ClinicalPredictionResult {
  const classLabel = String(raw.classLabel ?? 'MEDIUM');
  const probabilities = raw.probabilities ?? { LOW: 0.33, MEDIUM: 0.34, HIGH: 0.33 };
  const riskScore = raw.riskScore ?? riskScoreFromProbs(probabilities);
  const alert =
    raw.alertLevel === 'CRITICAL' || raw.alertLevel === 'WARNING' || raw.alertLevel === 'NORMAL'
      ? raw.alertLevel
      : alertLevel(classLabel, riskScore);

  return {
    modelId,
    classLabel,
    probabilities,
    relapseProbability: Number(probabilities.HIGH ?? probabilities.MEDIUM ?? riskScore),
    riskLevel: classLabel,
    riskScore,
    psychologicalScore: Math.round((1 - riskScore) * 10000) / 10000,
    alertLevel: alert,
    recommendations: raw.recommendations ?? clinicalRecommendations(classLabel, featuresUsed),
    featuresUsed,
    offline: opts?.offline,
    datasetId: ARFF_DATASET_SCHEMA.id,
  };
}
