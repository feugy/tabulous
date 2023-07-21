import { faker } from '@faker-js/faker'
import { load } from '@src/routes/[[lang=lang]]/(auth)/+layout.server'
import { redirect } from '@sveltejs/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
  const depends = vi.fn()

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
          load({
            url: new URL(location, 'https://example.org'),
            locals: {},
            params: { lang },
            depends
          })
        ).rejects.toEqual(
          redirect(
            307,
            `${urlRoot}/login?redirect=${encodeURIComponent(location)}`
          )
        )
        expect(depends).toHaveBeenCalledWith('data:session')
      })

      it('redirects to terms on first connection when accessing an url', async () => {
        const session = {
          player: {
            id: faker.number.int(999),
            username: faker.person.fullName()
          }
        }
        await expect(
          load({
            url: new URL(location, 'https://example.org'),
            locals: { session },
            params: { lang },
            depends
          })
        ).rejects.toEqual(
          redirect(
            307,
            `${urlRoot}/accept-terms?redirect=${encodeURIComponent(location)}`
          )
        )
        expect(depends).not.toHaveBeenCalled()
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
          await load({
            url: new URL(location, 'https://example.org'),
            locals: { session },
            params: { lang },
            depends
          })
        ).toEqual({
          lang,
          session,
          bearer: null
        })
        expect(depends).toHaveBeenCalledWith('data:session')
      })
    })
  })
})
