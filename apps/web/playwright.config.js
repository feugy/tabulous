/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/integration',
  reporter: [
    ['list'],
    process.env.CI
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
  }
}

export default config
