import { API_BASE } from "./utils";

export async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const dashboardApi = {
  login: (body: { username: string; password: string; siteId?: string }) =>
    fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ accessToken: string; refreshToken: string }>;
    }),
  kpis: (token: string, from: string, to: string) =>
    api<Record<string, unknown>>(`/api/analytics/dashboard/kpis?from=${from}&to=${to}`, token),
  appointmentsTrend: (token: string, from: string, to: string) =>
    api<{ series: Array<{ bucket: string; total: number }> }>(
      `/api/analytics/dashboard/appointments/trend?from=${from}&to=${to}&groupBy=DAY`,
      token,
    ),
  j48Distribution: (token: string) =>
    api<Array<{ label: string; count: number }>>("/api/j48/analytics/class-distribution", token),
  appointments: (token: string) => api<unknown[]>("/api/appointments?limit=50", token),
  patients: (token: string) => api<{ items: unknown[] }>("/api/patients?limit=20", token),
  psychologyEvolution: (token: string, patientId: string) =>
    api<Record<string, unknown>>(`/api/psychology/patients/${patientId}/evolution`, token),
  j48Tree: (token: string) => api<Record<string, unknown>>("/api/j48/model/tree", token),
};
