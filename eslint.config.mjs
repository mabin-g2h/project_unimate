import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test harness (Playwright/Vitest) — not app code.
    "tests/**",
    "playwright.config.ts",
    "vitest.config.ts",
    "public/__test_uploads/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
