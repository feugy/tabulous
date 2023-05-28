import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadConfiguration } from '../../src/util/configuration.js'

describe('loadConfiguration()', () => {
  const { ...envSave } = process.env
  const jwtKey = faker.internet.password()

  beforeEach(() => {
    process.env = { ...envSave }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('loads values from environment variables', () => {
    const url = faker.internet.ip()
    const adminUserId = faker.string.uuid()

    process.env = {
      ...process.env,
      URL: url,
      JWT_KEY: jwtKey,
      ADMIN_USER_ID: adminUserId
    }

    expect(loadConfiguration()).toEqual({
      url,
      jwt: { key: jwtKey },
      adminUserId
    })
  })

  it('reports missing variables', () => {
    expect(loadConfiguration).toThrow(`must have property 'url'`)
    expect(loadConfiguration).toThrow(`must have property 'adminUserId'`)
    expect(loadConfiguration).toThrow(`/jwt must have property 'key'`)
  })
})
