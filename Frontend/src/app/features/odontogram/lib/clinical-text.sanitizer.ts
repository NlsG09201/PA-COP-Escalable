/** Client-side clinical text normalization (aligns with server sanitizer; defense in depth). */
const MAX = 4000;

export function sanitizeClinicalText(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = raw.trim();
  if (s.length > MAX) s = s.substring(0, MAX);
  s = s.replace(/</g, ' ').replace(/>/g, ' ');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}
