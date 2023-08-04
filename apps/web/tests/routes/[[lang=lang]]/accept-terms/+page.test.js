// @ts-check
/** @typedef {import('@src/common').Locale} Locale */
/**
 * @template T
 * @typedef {import('rxjs').BehaviorSubject<T>} BehaviorSubject
 */

import { initLocale } from '@src/common'
import AcceptTermsPage from '@src/routes/[[lang=lang]]/accept-terms/+page.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import * as stores from '$app/stores'

vi.mock('$app/stores', () => {
  const { BehaviorSubject } = require('rxjs')
  return { page: new BehaviorSubject(undefined) }
})

/** @type {BehaviorSubject<{ url: URL, route: Object, params: { lang: Locale|undefined }}>} */
const page = /** @type {?} */ (stores.page)

describe.each(
  /** @type {{ title: String, lang: Locale|undefined, urlRoot: string }[]} */ ([
    { title: '/', lang: undefined, urlRoot: '' },
    { title: '/en', lang: 'en', urlRoot: '/en' }
  ])
)('$title', ({ lang, urlRoot }) => {
  beforeAll(() => {
    page.next({
      url: new URL(`http://localhost/${urlRoot}/accept-terms`),
      route: { id: `[[lang=lang]]/accept-terms` },
      params: { lang }
    })
    initLocale(lang)
  })

  describe('/accept-terms route', () => {
    it('enables checkboxes on scroll', () => {
      render(html`<${AcceptTermsPage} data=${{}} />`)
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toBeDisabled()
      }
      // simulate scrolling Terms of Service until the end
      // @ts-expect-error: intersactionObservers are mocked
      window.intersectionObservers[0].notify([{ intersectionRatio: 1 }])
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toBeDisabled()
      }
    })

    it('enables button when checking boxes', async () => {
      render(html`<${AcceptTermsPage} data=${{}} />`)
      const submitButton = screen.getByRole('button', {
        name: `emoji_people ${translate('actions.log-in')}`
      })
      // @ts-expect-error: intersactionObservers are mocked
      window.intersectionObservers[0].notify([{ intersectionRatio: 1 }])

      expect(submitButton).toBeDisabled()
      const [acceptCheckbox, ageCheckbox] = screen.getAllByRole('checkbox')
      await fireEvent.click(acceptCheckbox)
      expect(submitButton).toBeDisabled()
      await fireEvent.click(ageCheckbox)
      expect(submitButton).toBeEnabled()
      await fireEvent.click(acceptCheckbox)
      expect(submitButton).toBeDisabled()
    })
  })
})
