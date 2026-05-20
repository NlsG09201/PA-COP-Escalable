import { api } from "./api";

export type MedicalAlert = {
  _id: string;
  patientId: string;
  patientName: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  recommendations: string[];
  priorityScore: number;
  status: string;
  createdAt?: string;
};

export type PredictiveKpis = {
  openAlerts: number;
  highRiskPatientCount: number;
  averageRelapseProbabilityPct: number;
  predictedNoShowRatePct: number;
  scheduleSaturationIndex: number;
  medicalLoadForecast: number;
  riskTrendSeries: Array<{ bucket: string; avgRisk: number; assessments: number }>;
  riskHeatmap: Array<{ riskLevel: string; count: number }>;
};

export type TimelineResponse = {
  events: Array<{
    id: string;
    at: string;
    domain: string;
    title: string;
    summary: string;
    sentiment?: string;
    riskMarker?: string;
    aiDetected?: boolean;
  }>;
  analysis: {
    trend: string;
    futureRisk: string;
    correlations: string[];
  };
};

export const medicalAiApi = {
  predictiveDashboard: (token: string, from: string, to: string) =>
    api<PredictiveKpis>(`/api/medical-ai/dashboard/predictive?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, token),

  alerts: (token: string) => api<MedicalAlert[]>("/api/medical-ai/alerts?limit=40", token),

  acknowledgeAlert: (token: string, alertId: string) =>
    api<MedicalAlert>(`/api/medical-ai/alerts/${alertId}/acknowledge`, token, { method: "PUT" }),

  assessPatient: (token: string, patientId: string) =>
    api<Record<string, unknown>>(`/api/medical-ai/patients/${patientId}/assess`, token, { method: "POST" }),

  latestPrediction: (token: string, patientId: string) =>
    api<Record<string, unknown> | null>(`/api/medical-ai/patients/${patientId}/prediction/latest`, token),

  predictionHistory: (token: string, patientId: string) =>
    api<Record<string, unknown>[]>(`/api/medical-ai/patients/${patientId}/prediction/history?limit=24`, token),

  timeline: (token: string, patientId: string) =>
    api<TimelineResponse>(`/api/medical-ai/patients/${patientId}/timeline`, token),

  recommendations: (token: string, patientId: string) =>
    api<Record<string, unknown>>(`/api/medical-ai/patients/${patientId}/recommendations`, token),

  assistantChat: (token: string, patientId: string, message: string) =>
    api<{ reply: string; provider: string }>(`/api/medical-ai/patients/${patientId}/assistant/chat`, token, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  assistantSummary: (token: string, patientId: string) =>
    api<{ reply: string; provider: string }>(`/api/medical-ai/patients/${patientId}/assistant/summary`, token),

  priorityPatients: (token: string) =>
    api<Array<{ patientId: string; urgency: number; riskLevel: string; dynamicScore: number }>>(
      "/api/medical-ai/patients/priority?limit=12",
      token,
    ),

  insights: (token: string) => api<Record<string, unknown>[]>("/api/medical-ai/insights", token),

  generateInsights: (token: string) =>
    api<Record<string, unknown>[]>("/api/medical-ai/insights/generate", token, { method: "POST" }),
};
