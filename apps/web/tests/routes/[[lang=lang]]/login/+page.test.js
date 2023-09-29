// @ts-check
import { initLocale } from '@src/common'
import LoginPage from '@src/routes/[[lang=lang]]/login/+page.svelte'
import { render } from '@testing-library/svelte'
import html from 'svelte-htm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import * as stores from '$app/stores'

vi.mock('$app/stores', () => {
  const { BehaviorSubject } = require('rxjs')
  return { page: new BehaviorSubject(undefined) }
})

/** @type {import('rxjs').BehaviorSubject<{ url: URL, route: Object, params: { lang: import('@src/common').Locale|undefined }}>} */
const page = /** @type {?} */ (stores.page)

describe.each(
  /** @type {{ title: String, lang: import('@src/common').Locale|undefined, urlRoot: string }[]} */ ([
    { title: '/', lang: undefined, urlRoot: '' },
    { title: '/en', lang: 'en', urlRoot: '/en' }
  ])
)('$title', ({ lang, urlRoot }) => {
  beforeAll(() => {
    page.next({
      url: new URL(`http://localhost/${urlRoot}/login`),
      route: { id: `[[lang=lang]]/login` },
      params: { lang }
    })
    initLocale(lang)
  })

  describe('/login route', () => {
    it('displays all options', async () => {
      const { container } = render(html`<${LoginPage} />`)
      expect(container).toMatchSnapshot()
    })

    it('expands login panel on error', async () => {
      const { container } = render(
        html`<${LoginPage} form=${{ message: 'wrong password' }} />`
      )
      expect(container).toMatchSnapshot()
    })
  })
})
