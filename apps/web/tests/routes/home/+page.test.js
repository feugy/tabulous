import { render, screen, waitFor } from '@testing-library/svelte'
import html from 'svelte-htm'
import { load } from '../../../src/routes/home/+page'
import HomePage from '../../../src/routes/home/+page.svelte'
import { listGames, listCatalog } from '../../../src/stores'

jest.mock('../../../src/stores', () => ({
  receiveGameListUpdates: jest.fn(),
  listCatalog: jest.fn(),
  listGames: jest.fn()
}))

describe('/home route', () => {
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

  it('displays anonymous catalog', async () => {
    const { container } = render(
      html`<${HomePage} data=${{ catalog: games.slice(0, 2) }} />`
    )
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(container).toMatchSnapshot()
  })

  it('displays connected catalog', async () => {
    const player = { username: 'John Doo' }
    const { container } = render(
      html`<${HomePage}
        data=${{
          session: { player },
          catalog: games,
          currentGames: [
            {
              name: '32-cards',
              locales: { fr: { title: 'Jeu de 32 cartes' } },
              players: [],
              created: Date.parse('2022-07-15 10:15:00')
            }
          ]
        }}
      />`
    )
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(container).toMatchSnapshot()
  })
})

describe('/home reoute loader', () => {
  beforeEach(jest.clearAllMocks)

  it('loads catalog only for anonymous user', async () => {
    const parent = async () => ({ session: null })
    const catalog = [{ id: 'game-1' }, { id: 'game-2' }]
    listCatalog.mockResolvedValueOnce(catalog)
    expect(await load({ parent })).toEqual({
      catalog,
      currentGames: null
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).not.toHaveBeenCalled()
  })

  it('loads catalog and current games for authenticated user', async () => {
    const parent = async () => ({ session: { player: { name: 'dude' } } })
    const catalog = [{ id: 'game-1' }, { id: 'game-2' }]
    const currentGames = [{ id: 'game-3' }]
    listCatalog.mockResolvedValueOnce(catalog)
    listGames.mockResolvedValueOnce(currentGames)
    expect(await load({ parent })).toEqual({
      catalog,
      currentGames
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).toHaveBeenCalledTimes(1)
  })
})
