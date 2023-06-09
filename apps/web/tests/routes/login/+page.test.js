import LoginPage from '@src/routes/login/+page.svelte'
import { render } from '@testing-library/svelte'
import html from 'svelte-htm'
import { describe, expect, it, vi } from 'vitest'

vi.mock('$app/stores', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    page: new BehaviorSubject({
      url: new URL('http://localhost/login'),
      route: { id: '/login' }
    })
  }
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
