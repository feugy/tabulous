// @ts-check
import { test } from '@playwright/test'

import {
  extendCoverage,
  initializeCoverage,
  writeCoverage
} from './coverage.js'

export const it = test.extend({
  coverageMap: [
    // @ts-expect-error
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const coverageMap = await initializeCoverage()
      await use(coverageMap)
      await writeCoverage(coverageMap)
    },
    { scope: 'worker' }
  ],

  // @ts-expect-error
  page: async ({ browserName, page, coverageMap }, use) => {
    if (browserName !== 'chromium') {
      console.log(`coverage is not supported on ${browserName}`)
    } else {
      const handleConsole = (/** @type {...?} */ ...args) => {
        console.log(...args)
      }
      page.on('console', handleConsole)

      await page.coverage.startJSCoverage()
      await use(page)
      page.removeListener('console', handleConsole)
      // @ts-expect-error
      await extendCoverage(coverageMap, await page.coverage.stopJSCoverage())
    }
  }
})

export const describe = test.describe

export const expect = test.expect

export const beforeEach = test.beforeEach
