import { describe, it, expect } from 'vitest';
import { loomEmbedUrl } from '@/lib/onboarding';

const ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('loomEmbedUrl', () => {
  it.each([
    [`https://www.loom.com/share/${ID}`, `https://www.loom.com/embed/${ID}`],
    [`https://loom.com/share/${ID}?sid=abc`, `https://www.loom.com/embed/${ID}`],
    [`https://www.loom.com/embed/${ID}`, `https://www.loom.com/embed/${ID}`],
    [`  https://www.loom.com/share/${ID}  `, `https://www.loom.com/embed/${ID}`],
  ])('converts %s', (input, out) => expect(loomEmbedUrl(input)).toBe(out));

  it.each([
    '',
    'not a url',
    `http://www.loom.com/share/${ID}`,
    `https://evil.com/share/${ID}`,
    `https://www.loom.com.evil.com/share/${ID}`,
    `https://evil.com/?u=https://www.loom.com/share/${ID}`,
    'https://www.loom.com/share/short',
    `https://www.loom.com/other/${ID}`,
    `javascript:alert(1)//https://www.loom.com/share/${ID}`,
  ])('rejects %j', input => expect(loomEmbedUrl(input)).toBeNull());
});
