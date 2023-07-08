import { initLocale } from '@src/common'
import AcceptTermsPage from '@src/routes/[[lang=lang]]/accept-terms/+page.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { page } from '$app/stores'

vi.mock('$app/stores', () => {
  const { BehaviorSubject } = require('rxjs')
  return { page: new BehaviorSubject() }
})

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
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
      render(html`<${AcceptTermsPage} />`)
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toBeDisabled()
      }
      // simulate scrolling Terms of Service unti lthe end
      window.intersectionObservers[0].notify([{ intersectionRatio: 1 }])
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toBeDisabled()
      }
    })

    it('enables button when checking boxes', async () => {
      render(html`<${AcceptTermsPage} />`)
      const submitButton = screen.getByRole('button', {
        name: `emoji_people ${translate('actions.log-in')}`
      })
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
