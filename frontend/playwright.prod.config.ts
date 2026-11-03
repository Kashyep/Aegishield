import { defineConfig, devices } from '@playwright/test'

/**
 * Production build served same-origin by the backend, exactly as on SAP BTP / Docker:
 * `vite build` in live mode into work/prod-dist, then uvicorn serves it at /.
 * Guards against build-only regressions (e.g. env reads that work in `vite dev` but not
 * in a bundle). Run: npm run test:prod
 */
const ORIGIN = 'http://127.0.0.1:8020'
export default defineConfig({
  testDir: './tests-prod',
  workers: 1,
  reporter: 'list',
  use: { baseURL: ORIGIN, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command:
      'npx vite build --outDir ../work/prod-dist --emptyOutDir && cd .. && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8020',
    url: `${ORIGIN}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_MODE: 'live',
      VITE_API_BASE_URL: '/',
      AEGIS_DEMO_MODE: '1',
      AEGIS_LLM_MODE: 'recorded',
      AEGIS_DB_PATH: 'work/e2e-prod.sqlite3',
      AEGIS_FRONTEND_DIST: 'work/prod-dist',
    },
  },
})
