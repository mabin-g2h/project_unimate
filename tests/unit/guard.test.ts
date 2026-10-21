import { describe, it, expect } from 'vitest';
import { assertSafeTestDb } from '../helpers/env';

const base = { TEST_MODE: '1', TEST_DB_ALLOWED_HOSTS: 'ep-test-pooler.c-7.us-east-1.aws.neon.tech', PROD_DB_HOST_MARKER: 'ep-red-queen-apffrdjy' };
const url = (host: string) => `postgresql://u:p@${host}/neondb?sslmode=require`;

describe('test DB guard', () => {
  it('aborts on the production host', () => {
    expect(() => assertSafeTestDb({ ...base, DATABASE_CONNECTION_STRING: url('ep-red-queen-apffrdjy-pooler.c-7.us-east-1.aws.neon.tech') })).toThrow(/PRODUCTION/);
  });
  it('aborts on a host not on the allow-list', () => {
    expect(() => assertSafeTestDb({ ...base, DATABASE_CONNECTION_STRING: url('ep-other.c-7.us-east-1.aws.neon.tech') })).toThrow(/allow-list|TEST_DB_ALLOWED_HOSTS/);
  });
  it('aborts without TEST_MODE=1', () => {
    expect(() => assertSafeTestDb({ ...base, TEST_MODE: '0', DATABASE_CONNECTION_STRING: url('ep-test-pooler.c-7.us-east-1.aws.neon.tech') })).toThrow(/TEST_MODE/);
  });
  it('aborts on an empty connection string', () => {
    expect(() => assertSafeTestDb({ ...base, DATABASE_CONNECTION_STRING: '' })).toThrow(/empty/);
  });
  it('allows an allow-listed non-production host', () => {
    expect(assertSafeTestDb({ ...base, DATABASE_CONNECTION_STRING: url('ep-test-pooler.c-7.us-east-1.aws.neon.tech') })).toContain('ep-test-pooler');
  });
});
