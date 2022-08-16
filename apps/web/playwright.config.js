const isCI = !!process.env.CI
const isDebug = !!process.env.PWDEBUG

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/integration',
  quiet: !isCI && !isDebug,
  reporter: [
    ['list'],
    isCI
      ? ['github']
      : ['html', { open: 'never', outputFolder: 'coverage/integration' }]
  ],
  use: {
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    browserName: 'chromium',
    locale: 'fr-FR',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview',
    url: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    timeout: 30000
  },
  workers: 1
}

export default config
