import { render, screen, waitFor } from '@testing-library/svelte'
import html from 'svelte-htm'
import HomePage from '../../../src/routes/home/+page.svelte'
import { initGraphQLGlient } from '../../../src/stores'
import { graphQlUrl } from '../../../src/utils'
import { configureGraphQlServer } from '../../test-utils'

describe('/home route', () => {
  const mocks = { handleGraphQl: jest.fn() }

  configureGraphQlServer(mocks)

  const games = [
    {
      name: '32-cards',
      locales: { fr: { title: 'Jeu de 32 cartes' } },
      minAge: null,
      minTime: null
    },
    {
      name: 'klondike',
      locales: { fr: { title: 'Solitaire' } },
      minAge: 7,
      minTime: 15
    },
    {
      name: '6-takes',
      locales: { fr: { title: '6 qui prend' } },
      minAge: 10,
      minTime: 15
    }
  ]

  beforeEach(() => {
    initGraphQLGlient({ graphQlUrl, fetch })
  })

  it('displays anonymous catalog', async () => {
    mocks.handleGraphQl.mockReturnValue(games.slice(0, 2))
    const { container } = render(html`<${HomePage} data=${{}} />`)
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(container).toMatchSnapshot()
  })

  it('displays connected catalog', async () => {
    mocks.handleGraphQl.mockReturnValueOnce(games)
    const player = { username: 'John Doo' }
    const { container } = render(
      html`<${HomePage} data=${{ session: { player } }} />`
    )
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(container).toMatchSnapshot()
  })
})
