import { describe, expect, it, vi } from 'vitest'

import { load } from '../../src/routes/+page'

vi.mock('@sveltejs/kit', () => ({
  redirect(status, location) {
    return new Error(`${status} redirection to ${location}`)
  }
}))

describe('/ route server loader', () => {
  it('always redirects to home page', async () => {
    expect(load).toThrow('307 redirection to /home')
  })
})
