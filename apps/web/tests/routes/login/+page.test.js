import { render } from '@testing-library/svelte'
import html from 'svelte-htm'
import LoginPage from '../../../src/routes/login/+page.svelte'

jest.mock('$app/stores', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    page: new BehaviorSubject({ url: new URL('http://localhost/login') })
  }
})

describe('/login route', () => {
  it('displays all options', async () => {
    const { container } = render(html`<${LoginPage} />`)
    expect(container).toMatchSnapshot()
  })

  it('expands login panel and show all options', async () => {
    const { container } = render(
      html`<${LoginPage} errors=${'wrong password'} />`
    )
    expect(container).toMatchSnapshot()
  })
})