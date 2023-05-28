const isCI = !!process.env.CI
const isDebug = !!process.env.PWDEBUG || !!process.env.DEBUG

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
    command: 'pnpm preview',
    url: 'https://localhost:3000/robots.txt',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 5000
  },
  workers: 1
}

export default config
