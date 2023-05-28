import { configureToolshot } from '@atelier-wb/toolshot'
import { join } from 'path'
import { beforeAll } from 'vitest'

import * as stores from '$app/stores'

import { setStoreMockForTestSuite } from './setup'

beforeAll(() => setStoreMockForTestSuite(stores))

configureToolshot({
  folder: join(__dirname, '..'),
  timeout: 20000
})
