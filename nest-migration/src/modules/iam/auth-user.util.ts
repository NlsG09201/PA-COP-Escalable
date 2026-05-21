import { extractPasswordHash } from './password-hash.util';

export type AuthUserDoc = {
  _id?: unknown;
  username?: string;
  email?: string;
  organization_id?: unknown;
  roles?: unknown;
  password_hash?: unknown;
  password?: unknown;
  passwordHash?: unknown;
  patient_id?: unknown;
  mfa_enabled?: boolean;
};

/** Lee hash bcrypt desde cualquier campo legacy en el documento users. */
export function passwordHashFromDoc(raw: AuthUserDoc): string {
  for (const key of ['password_hash', 'password', 'passwordHash'] as const) {
    const h = extractPasswordHash(raw[key]);
    if (h.startsWith('$2')) return h;
  }
  return '';
}

export function usernameFilter(loginId: string): Record<string, unknown> {
  const id = loginId.toLowerCase().trim();
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usernameRegex = new RegExp(`^${escaped}$`, 'i');
  const clauses: Record<string, unknown>[] = [
    { username: usernameRegex },
    { username: id },
  ];
  if (id.includes('@')) {
    clauses.push({ email: usernameRegex }, { email: id });
  }
  return { $or: clauses };
}
