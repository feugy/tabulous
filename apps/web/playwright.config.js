/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/integration',
  use: {
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    browserName: 'chromium'
  },
  webServer: {
    // reuseExistingServer: true,
    command: 'npm run preview',
    url: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    timeout: 30000
  }
}

export default config
