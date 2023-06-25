import { configureToolshot } from '@atelier-wb/toolshot'
import { join } from 'path'
import { beforeAll, beforeEach, vi } from 'vitest'

import * as stores from '$app/stores'

import { setStoreMockForTestSuite } from './setup'

beforeAll(() => setStoreMockForTestSuite(stores))

beforeEach(() => {
  let nextInt = 1000
  vi.spyOn(Math, 'random').mockImplementation(() => nextInt++ / 10000)
})

configureToolshot({
  folder: join(__dirname, '..'),
  timeout: 20000
})
