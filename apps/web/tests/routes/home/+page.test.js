import { render, screen, waitFor } from '@testing-library/svelte'
import html from 'svelte-htm'
import HomePage from '../../../src/routes/home/+page.svelte'
import { runQuery } from '../../../src/stores/graphql-client'

jest.mock('../../../src/stores/graphql-client', () => {
  const { jest } = require('@jest/globals')
  const { BehaviorSubject } = require('rxjs')
  const sub = new BehaviorSubject([])
  return {
    initGraphQlClient: jest.fn(),
    runQuery: jest.fn(),
    runSubscription: jest.fn().mockReturnValue(sub)
  }
})

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
    runQuery.mockResolvedValue(games.slice(0, 2))
    const { container } = render(html`<${HomePage} data=${{}} />`)
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(container).toMatchSnapshot()
  })

  it('displays connected catalog', async () => {
    runQuery.mockResolvedValueOnce(games)
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
