import { describe, expect, it } from 'vitest';
import { matchupIdentity, normalizeEntityName } from '../src/lib/matchups';

describe('permanent matchup identity', () => {
  it('normalizes case and whitespace in names', () => {
    expect(normalizeEntityName('  Alexander   the GREAT ')).toBe('alexander the great');
  });

  it('maps either competitor order to the same canonical page', () => {
    const forward = matchupIdentity('Alexander the Great', 'Stalin');
    const reverse = matchupIdentity(' Stalin ', 'ALEXANDER THE GREAT');
    expect(reverse.canonicalKey).toBe(forward.canonicalKey);
    expect(reverse.slug).toBe(forward.slug);
  });

  it('keeps different pairings distinct', () => {
    expect(matchupIdentity('KSI', 'MrBeast').canonicalKey)
      .not.toBe(matchupIdentity('KSI', 'Stalin').canonicalKey);
    expect(matchupIdentity('KSI', 'MrBeast').slug)
      .not.toBe(matchupIdentity('KSI', 'Stalin').slug);
  });
});
