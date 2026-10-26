import { describe, it, expect } from 'vitest';
import { COUNTRIES, ACCEPTANCE_DOCS } from '@/lib/countries';

describe('COUNTRIES', () => {
  it('has no duplicates, blanks or stray whitespace', () => {
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) expect(c).toBe(c.trim()), expect(c.length).toBeGreaterThan(1);
  });
  it('is alphabetical', () => expect([...COUNTRIES].sort((a, b) => a.localeCompare(b))).toEqual([...COUNTRIES]));
  it('contains the main study-abroad destinations used by the dropdown seeds', () => {
    for (const c of ['Australia', 'Canada', 'United Kingdom', 'United States', 'Germany', 'Ireland', 'New Zealand']) expect(COUNTRIES).toContain(c);
  });
  it('ACCEPTANCE_DOCS only names real countries and covers the five documented documents', () => {
    for (const c of Object.keys(ACCEPTANCE_DOCS)) expect(COUNTRIES).toContain(c);
    expect(Object.values(ACCEPTANCE_DOCS).map(d => d.short).sort()).toEqual(['CAS', 'CoE', 'I-20', 'IPA', 'LOA']);
  });
  it('has the 65 entries documented in CLAUDE.md', () => expect(COUNTRIES).toHaveLength(65));
});
