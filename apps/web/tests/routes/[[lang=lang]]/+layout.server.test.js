// @ts-check
import { faker } from '@faker-js/faker'
import { load } from '@src/routes/[[lang=lang]]/+layout.server'
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

  describe('layout server loader', () => {
    describe('given first connection', () => {
      const session = {
        player: {
          id: faker.number.int(999).toString(),
          username: faker.person.fullName()
        }
      }

      it('does not redirect when accessing terms', () => {
        expect(
          load(
            /** @type {?} */ ({
              url: new URL(`${urlRoot}/accept-terms`, 'https://example.org'),
              locals: { bearer: null, timeZone: 'GMT', session },
              params: { lang },
              depends
            })
          )
        ).toEqual({
          lang,
          session,
          bearer: null,
          timeZone: 'GMT'
        })
        expect(depends).toHaveBeenCalledWith('data:session')
      })

      describe.each([{ location: `/` }, { location: `${urlRoot}/home` }])(
        'when accessing $location',
        ({ location }) => {
          it('redirects to terms', async () => {
            await expect(async () =>
              load(
                /** @type {?} */ ({
                  url: new URL(location, 'https://example.org'),
                  locals: { session },
                  params: { lang },
                  depends
                })
              )
            ).rejects.toEqual(
              redirect(
                307,
                `${urlRoot}/accept-terms?redirect=${encodeURIComponent(
                  location
                )}`
              )
            )
            expect(depends).not.toHaveBeenCalled()
          })
        }
      )
    })
  })
})
