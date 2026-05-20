import { API_BASE } from "./utils";

export type ApiError = { message: string; status: number };

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw { message: body || res.statusText, status: res.status } as ApiError;
  }
  return parseJson<T>(res);
}

export const publicApi = {
  departments: () => apiFetch<string[]>("/public/departments"),
  sites: (department?: string) =>
    apiFetch<Array<Record<string, unknown>>>(
      `/public/sites${department ? `?department=${encodeURIComponent(department)}` : ""}`,
    ),
  catalog: (siteId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/public/catalog?siteId=${encodeURIComponent(siteId)}`),
  availability: (siteId: string, serviceId: string, from: string, to: string) =>
    apiFetch<Record<string, unknown>>(
      `/public/availability?siteId=${siteId}&serviceId=${serviceId}&from=${from}&to=${to}`,
    ),
  quoteBooking: (body: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/public/bookings/quote", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createBooking: (body: Record<string, unknown>, token?: string | null) =>
    apiFetch<Record<string, unknown>>("/public/bookings", {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  paymentMethods: () => apiFetch<Record<string, unknown>>("/public/payments/methods"),
  intlMethods: () => apiFetch<Record<string, unknown>>("/public/payments/intl/methods"),
  stripeIntent: (body: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/public/payments/intl/stripe/intent", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  paypalOrder: (body: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/public/payments/intl/paypal/order", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const authApi = {
  login: (body: { username: string; password: string; siteId?: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (body: Record<string, unknown>) =>
    apiFetch<{ accessToken: string; refreshToken: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: (token: string) => apiFetch<Record<string, unknown>>("/api/users/me", { token }),
  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};
