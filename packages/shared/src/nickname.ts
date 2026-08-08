import { NICKNAME_MAX } from './config';

export function sanitizeNickname(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, NICKNAME_MAX);
}
