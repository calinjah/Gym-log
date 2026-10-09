import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: the real app in a phone-sized Chromium, served from a production build.
 * Time zone and (per test) clock are fixed so date-based features are tested reliably.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4300',
    timezoneId: 'Europe/London',
    locale: 'en-GB',
    serviceWorkers: 'block', // tests start from a clean page; the offline test opts back in
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4300 --strictPort',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
