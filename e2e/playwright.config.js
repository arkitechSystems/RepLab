// End-to-end tests: a real browser against a real server and a local test
// database (Docker Postgres). See e2e/README.md.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 3101);

export default defineConfig({
  testDir: './tests',
  // Each test signs up its own user, so tests don't share data — but they
  // share one server, so keep them one at a time for predictable timing.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'node start-server.mjs',
    url: `http://localhost:${PORT}/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
