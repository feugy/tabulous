/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'integration',
  use: {
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    browserName: 'firefox'
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
