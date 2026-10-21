import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv, BASE_URL, TEST_PORT } from './tests/helpers/env';

const testEnv = loadTestEnv();

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  globalSetup: './tests/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${TEST_PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Process env beats .env.local in Next, so every variable the app reads is set here
    // explicitly (empty string for the ones that must not reach production services).
    env: {
      ...testEnv,
      NODE_OPTIONS: '--dns-result-order=ipv4first',
      BLOB_STORE_ID: '',
      BLOB_READ_WRITE_TOKEN: '',
    },
  },
});
