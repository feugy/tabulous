// @ts-check
import { test } from '@playwright/test'
import {
  extendCoverage,
  initializeCoverage,
  writeCoverage
} from './coverage.js'

export const it = test.extend({
  coverageMap: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const coverageMap = await initializeCoverage()
      await use(coverageMap)
      await writeCoverage(coverageMap)
    },
    { scope: 'worker' }
  ],

  // @ts-ignore
  page: async ({ page, coverageMap }, use) => {
    function handleConsole(...args) {
      console.log(...args)
    }
    page.on('console', handleConsole)

    await page.coverage.startJSCoverage()
    await use(page)
    page.removeListener('console', handleConsole)
    await extendCoverage(coverageMap, await page.coverage.stopJSCoverage())
  }
})

export const describe = test.describe

export const expect = test.expect
