import { load } from '@src/routes/[[lang=lang]]/+page'
import { redirect } from '@sveltejs/kit'
import { describe, expect, it } from 'vitest'

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
  describe('/ route server loader', () => {
    it('always redirects to home page', async () => {
      try {
        load({ params: { lang } })
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toEqual(redirect(307, `${urlRoot}/home`))
      }
    })
  })
})
