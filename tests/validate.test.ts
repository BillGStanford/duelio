import { describe, expect, it } from 'vitest';
import { containsPersonalInfo, isValidSlug, parseSide, slugify, validateDefense, validateReport, validateSubmission, validateVoterName } from '@/lib/validate';

const good = {
  question: 'Should couples share their phone passwords?',
  sideA: 'Yes. Transparency matters.',
  sideB: 'No. Privacy still matters inside a relationship.',
  context: '',
  submitterName: 'Sam',
};

describe('validation', () => {
  it('accepts a good submission', () => {
    expect(validateSubmission(good).ok).toBe(true);
  });
  it('rejects empty, short, long and identical input', () => {
    expect(validateSubmission({}).ok).toBe(false);
    expect(validateSubmission({ ...good, question: 'Too short' }).ok).toBe(false);
    expect(validateSubmission({ ...good, question: 'x'.repeat(141) }).ok).toBe(false);
    expect(validateSubmission({ ...good, context: 'x'.repeat(281) }).ok).toBe(false);
    expect(validateSubmission({ ...good, sideB: good.sideA }).ok).toBe(false);
    expect(validateSubmission(null).ok).toBe(false);
  });
  it('blocks links, emails and phone numbers', () => {
    expect(containsPersonalInfo('see https://x.com/a')).toBe('links');
    expect(containsPersonalInfo('mail me a.b@example.com')).toBe('email addresses');
    expect(containsPersonalInfo('call 555 123 4567')).toBe('phone numbers');
    expect(containsPersonalInfo('plain and playful')).toBeNull();
    expect(validateSubmission({ ...good, context: 'text me at 555-123-4567' }).ok).toBe(false);
  });
  it('treats non-string fields as empty instead of crashing', () => {
    expect(validateSubmission({ question: { $ne: 1 }, sideA: [], sideB: 5 }).ok).toBe(false);
  });
  it('validates slugs and sides', () => {
    expect(isValidSlug('roommate-electricity')).toBe(true);
    for (const bad of ['', 'Has Space', '../etc/passwd', 'a--b', "x'; drop table dilemmas;--", 'a'.repeat(81), 5, null]) {
      expect(isValidSlug(bad)).toBe(false);
    }
    expect(parseSide('a')).toBe('a');
    expect(parseSide('c')).toBeNull();
  });
  it('slugifies', () => {
    expect(slugify('Is watching the next episode without your partner betrayal?')).toBe('is-watching-the-next-episode-without-your-partner-betrayal');
    const long = slugify('If one person orders significantly more than everyone else, should the group still split the bill evenly?');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
    expect(slugify('???')).toBe('dilemma');
  });
  it('validates reports', () => {
    expect(validateReport({ slug: 'a-b', targetType: 'dilemma', reason: 'This is rude' }).ok).toBe(true);
    expect(validateReport({ slug: 'a-b', targetType: 'user', reason: 'This is rude' }).ok).toBe(false);
    expect(validateReport({ slug: 'a-b', targetType: 'dilemma', reason: 'no' }).ok).toBe(false);
  });
  it('validates optional public voter names', () => {
    expect(validateVoterName(undefined)).toEqual({ ok: true, value: null });
    expect(validateVoterName(' Sam ')).toEqual({ ok: true, value: 'Sam' });
    expect(validateVoterName('a.b@example.com').ok).toBe(false);
    expect(validateVoterName('x'.repeat(33)).ok).toBe(false);
    expect(validateVoterName(5).ok).toBe(false);
  });
  it('validates one-line defenses and blocks personal details', () => {
    expect(validateDefense('The other side has a fair point.')).toEqual({ ok: true, value: 'The other side has a fair point.' });
    expect(validateDefense('short').ok).toBe(false);
    expect(validateDefense('My email is person@example.com').ok).toBe(false);
    expect(validateDefense('x'.repeat(181)).ok).toBe(false);
  });
});
