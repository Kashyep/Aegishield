import { defineConfig, devices } from '@playwright/test'

/** Full stack: real backend (fresh SQLite, recorded LLM mode) + frontend in live API mode. Run: npm run test:live */
const API = 'http://127.0.0.1:8010'
export default defineConfig({
  testDir: './tests-live',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    {
      command: 'python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010',
      cwd: '..',
      url: `${API}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { AEGIS_DEMO_MODE: '1', AEGIS_LLM_MODE: 'recorded', AEGIS_DB_PATH: 'work/e2e-live.sqlite3', AEGIS_FRONTEND_DIST: 'work/no-dist' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { VITE_API_MODE: 'live', VITE_API_BASE_URL: API },
    },
  ],
})
