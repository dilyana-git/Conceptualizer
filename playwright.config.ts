import { defineConfig, devices } from '@playwright/test';

/** §3.1: Playwright for smoke tests. Runs against the real production build. */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // §9: every explorable is tested at 375px before it is considered done.
    { name: 'mobile-375', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 720 } } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
