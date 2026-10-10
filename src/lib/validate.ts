import type { ReportTarget, Side } from './types';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length <= 80 && SLUG_RE.test(s);
}

export function parseSide(v: unknown): Side | null {
  return v === 'a' || v === 'b' ? v : null;
}

export function parseTarget(v: unknown): ReportTarget | null {
  return v === 'dilemma' || v === 'discussion' ? v : null;
}

/** Trim, normalise newlines, drop control characters. Non-strings become ''. */
export function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanLine(v: unknown): string {
  return cleanText(v).replace(/\s*\n\s*/g, ' ');
}

/** Detects links, emails and phone-like numbers, which submissions must not contain. */
export function containsPersonalInfo(text: string): string | null {
  if (/https?:\/\/|www\./i.test(text)) return 'links';
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) return 'email addresses';
  if (/(?:\d[\s().-]*){9,}/.test(text)) return 'phone numbers';
  return null;
}

export function validateVoterName(value: unknown): Validated<string | null> {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'That display name is not valid.' };
  const name = cleanLine(value);
  if (name.length > 32) return { ok: false, error: 'Keep your display name under 32 characters.' };
  const personalInfo = containsPersonalInfo(name);
  if (personalInfo) return { ok: false, error: `Your display name cannot include ${personalInfo}.` };
  return { ok: true, value: name || null };
}

export function validateDefense(value: unknown): Validated<string> {
  const body = cleanLine(value);
  if (body.length < 12 || body.length > 180)
    return { ok: false, error: 'A defense needs to be between 12 and 180 characters.' };
  const personalInfo = containsPersonalInfo(body);
  if (personalInfo) return { ok: false, error: `A defense cannot include ${personalInfo}.` };
  return { ok: true, value: body };
}

export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= 60) return base || 'dilemma';
  const cut = base.slice(0, 60);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut) || 'dilemma';
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SubmissionInput {
  question: string;
  sideA: string;
  sideB: string;
  context: string;
  submitterName: string;
}

export function validateSubmission(body: unknown): Validated<SubmissionInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const question = cleanLine(b.question);
  const sideA = cleanLine(b.sideA);
  const sideB = cleanLine(b.sideB);
  const context = cleanText(b.context);
  const submitterName = cleanLine(b.submitterName);

  if (question.length < 10 || question.length > 140)
    return { ok: false, error: 'The question needs to be between 10 and 140 characters.' };
  if (sideA.length < 3 || sideA.length > 120)
    return { ok: false, error: 'Side A needs to be between 3 and 120 characters.' };
  if (sideB.length < 3 || sideB.length > 120)
    return { ok: false, error: 'Side B needs to be between 3 and 120 characters.' };
  if (sideA.toLowerCase() === sideB.toLowerCase())
    return { ok: false, error: 'The two sides need to disagree with each other.' };
  if (context.length > 280) return { ok: false, error: 'Keep the context under 280 characters.' };
  if (submitterName.length > 40) return { ok: false, error: 'Keep the name under 40 characters.' };

  for (const [field, text] of [
    ['question', question],
    ['side A', sideA],
    ['side B', sideB],
    ['context', context],
    ['name', submitterName],
  ] as const) {
    const found = containsPersonalInfo(text);
    if (found) return { ok: false, error: `Remove ${found} from the ${field}. Keep it playful and anonymous.` };
  }
  return { ok: true, value: { question, sideA, sideB, context, submitterName } };
}

export interface ReportInput {
  slug: string;
  targetType: ReportTarget;
  reason: string;
}

export function validateReport(body: unknown): Validated<ReportInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const targetType = parseTarget(b.targetType);
  const reason = cleanText(b.reason);
  if (!isValidSlug(b.slug)) return { ok: false, error: 'Unknown dilemma.' };
  if (!targetType) return { ok: false, error: 'Choose what you are reporting.' };
  if (reason.length < 5 || reason.length > 500)
    return { ok: false, error: 'Tell us what is wrong in 5 to 500 characters.' };
  return { ok: true, value: { slug: b.slug, targetType, reason } };
}
