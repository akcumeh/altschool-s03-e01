/* Shared client-side validation helpers. Mirrors the backend DTO rules so
   users see design-system error states before a request is ever made. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Email is required.";
  if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address.";
  return null;
}

export function validateName(value: string): string | null {
  if (!value.trim()) return "Name is required.";
  if (value.trim().length < 2) return "Name looks too short.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

/** Positive integer within optional bounds. */
export function validateInt(
  value: string,
  label: string,
  opts: { min?: number; max?: number; optional?: boolean } = {},
): string | null {
  if (!value.trim()) return opts.optional ? null : `${label} is required.`;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    return `${label} must be a whole number.`;
  if (opts.min !== undefined && n < opts.min)
    return `${label} must be at least ${opts.min}.`;
  if (opts.max !== undefined && n > opts.max)
    return `${label} can be at most ${opts.max}.`;
  return null;
}

/** Non-negative amount (price). */
export function validateAmount(
  value: string,
  label: string,
  opts: { optional?: boolean } = {},
): string | null {
  if (!value.trim()) return opts.optional ? null : `${label} is required.`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  return null;
}
