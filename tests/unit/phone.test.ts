import { describe, it, expect } from 'vitest';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Mirrors app/api/student/register/route.ts: parse -> isValid -> store .number (E.164).
const normalise = (raw: string) => { const p = parsePhoneNumberFromString(raw.trim()); return p && p.isValid() ? p.number : null; };

describe('phone normalisation (register route logic)', () => {
  it.each([
    ['+91 98765 43210', '+919876543210'],
    ['+61 412 345 678', '+61412345678'],
    ['+1 (415) 555-2671', '+14155552671'],
    ['  +447911123456  ', '+447911123456'],
  ])('%s -> %s', (raw, e164) => expect(normalise(raw)).toBe(e164));
  it.each(['', '12345', '9876543210', 'abc', '+1 555', '+99 123'])('rejects %j', raw => expect(normalise(raw)).toBeNull());
});
