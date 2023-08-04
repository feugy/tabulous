// @ts-check
import { faker } from '@faker-js/faker'
import { load } from '@src/routes/[[lang=lang]]/(auth)/+layout.server'
import { redirect } from '@sveltejs/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('(auth) layout server loader', () => {
    describe.each([
      { location: `/` },
      { location: `${urlRoot}/game/${faker.string.uuid()}` }
    ])('when accessing $location', ({ location }) => {
      it('redirects to login without session', async () => {
        await expect(
          load(
            /** @type {?} */ ({
              url: new URL(location, 'https://example.org'),
              params: { lang },
              parent: async () => ({ session: null })
            })
          )
        ).rejects.toEqual(
          redirect(
            307,
            `${urlRoot}/login?redirect=${encodeURIComponent(location)}`
          )
        )
      })

      it('accepts session', async () => {
        const session = {
          player: {
            id: faker.number.int(999),
            username: faker.person.fullName(),
            termsAccepted: true
          }
        }
        expect(
          await load(
            /** @type {?} */ ({
              url: new URL(location, 'https://example.org'),
              params: { lang },
              parent: async () => ({ session })
            })
          )
        ).toEqual({ session })
      })
    })
  })
})
