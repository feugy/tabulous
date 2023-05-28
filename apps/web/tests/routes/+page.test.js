import { load } from '@src/routes/+page'
import { redirect } from '@sveltejs/kit'
import { describe, expect, it } from 'vitest'

describe('/ route server loader', () => {
  it('always redirects to home page', async () => {
    try {
      load()
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toEqual(redirect(307, '/home'))
    }
  })
})
