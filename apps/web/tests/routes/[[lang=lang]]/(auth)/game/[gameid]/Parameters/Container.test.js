import Parameters from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/Parameters/Container.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { extractText, sleep, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Parameters component', () => {
  const handleSubmit = vi.fn()

  beforeEach(vi.resetAllMocks)

  async function renderComponent(schema) {
    function onSubmit({ detail }) {
      handleSubmit(detail)
    }
    const result = render(
      html`<${Parameters} schema=${schema} on:submit=${onSubmit} />`
    )

    await sleep()
    return result
  }

  it('displays dropdown for enums', async () => {
    const colorLabel = 'Couleur'
    const colors = ['red', 'green', 'blue']
    const directionLabel = 'Direction'
    const directions = ['top', 'bottom', 'left', 'right']
    const schema = {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: colors,
          metadata: { fr: { name: colorLabel } }
        },
        direction: {
          type: 'string',
          enum: directions,
          metadata: { fr: { name: directionLabel } }
        }
      }
    }
    await renderComponent(schema)

    expect(
      screen.getByText(colorLabel + translate('labels.colon'), { trim: false })
    ).toBeInTheDocument()
    expect(
      screen.getByText(directionLabel + translate('labels.colon'), {
        trim: false
      })
    ).toBeInTheDocument()
    const [colorDropdown, directionDropdown] = screen.getAllByRole('combobox')
    expect(colorDropdown).toBeDefined()
    expect(directionDropdown).toBeDefined()

    await fireEvent.click(colorDropdown)
    expect(extractText(screen.getAllByRole('menuitem'))).toEqual(colors)

    await fireEvent.click(directionDropdown)
    expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
      // first menu
      ...colors,
      // second menu
      ...directions
    ])
    expect(handleSubmit).not.toHaveBeenCalled()
  })

  it('submits selected and default values', async () => {
    const colorLabel = 'Couleur'
    const colors = ['red', 'green', 'blue']
    const directionLabel = 'Direction'
    const directions = ['top', 'bottom', 'left', 'right']
    const schema = {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: colors,
          metadata: { fr: { name: colorLabel } }
        },
        direction: {
          type: 'string',
          enum: directions,
          metadata: { fr: { name: directionLabel } }
        }
      }
    }
    await renderComponent(schema)

    expect(
      screen.getByText(colorLabel + translate('labels.colon'), { trim: false })
    ).toBeInTheDocument()
    expect(
      screen.getByText(directionLabel + translate('labels.colon'), {
        trim: false
      })
    ).toBeInTheDocument()
    const [colorDropdown, directionDropdown] = screen.getAllByRole('combobox')
    expect(colorDropdown).toBeDefined()
    expect(directionDropdown).toBeDefined()

    await fireEvent.click(colorDropdown)
    await fireEvent.click(screen.getAllByRole('menuitem')[1])

    expect(colorDropdown).toHaveTextContent(colors[1])

    await fireEvent.click(
      screen.getByRole('button', { name: translate('actions.join-game') })
    )
    expect(handleSubmit).toHaveBeenCalledWith({
      color: colors[1],
      direction: directions[0]
    })
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('adjusts enum choices based on previous selections', async () => {
    const playerLabel = 'Joueur'
    const opponent1Label = 'Premier rival'
    const opponent2Label = 'Deuxième rival'
    const characters = ['jessica', 'leto', 'paul', 'duncan']
    const schema = {
      type: 'object',
      properties: {
        player: {
          type: 'string',
          enum: characters,
          metadata: { fr: { name: playerLabel } },
          not: {
            oneOf: [
              { const: { $data: '/opponent1' } },
              { const: { $data: '/opponent2' } }
            ]
          }
        },
        opponent1: {
          type: 'string',
          enum: characters,
          metadata: { fr: { name: opponent1Label } },
          not: {
            oneOf: [
              { const: { $data: '/player' } },
              { const: { $data: '/opponent2' } }
            ]
          }
        },
        opponent2: {
          type: 'string',
          enum: characters,
          metadata: { fr: { name: opponent2Label } },
          not: {
            oneOf: [
              { const: { $data: '/opponent1' } },
              { const: { $data: '/player' } }
            ]
          }
        }
      }
    }
    await renderComponent(schema)

    const [playerDropdown, opponent1Dropdown, opponent2Dropdown] =
      screen.getAllByRole('combobox')

    expect(playerDropdown).toHaveTextContent(characters[0])
    expect(opponent1Dropdown).toHaveTextContent(characters[1])
    expect(opponent2Dropdown).toHaveTextContent(characters[2])

    await fireEvent.click(playerDropdown)
    expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
      characters[0],
      characters[3]
    ])
    await fireEvent.click(screen.getAllByRole('menuitem')[1])
    expect(playerDropdown).toHaveTextContent(characters[3])
    expect(opponent1Dropdown).toHaveTextContent(characters[1])
    expect(opponent2Dropdown).toHaveTextContent(characters[2])

    await fireEvent.click(opponent1Dropdown)
    expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
      // first menu
      characters[0],
      characters[3],
      // second menu
      characters[0],
      characters[1]
    ])
    await fireEvent.click(screen.getAllByRole('menuitem')[2])

    expect(playerDropdown).toHaveTextContent(characters[3])
    expect(opponent1Dropdown).toHaveTextContent(characters[0])
    expect(opponent2Dropdown).toHaveTextContent(characters[2])

    await fireEvent.click(
      screen.getByRole('button', { name: translate('actions.join-game') })
    )
    expect(handleSubmit).toHaveBeenCalledWith({
      player: characters[3],
      opponent1: characters[0],
      opponent2: characters[2]
    })
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('displays new properties based on previous selections', async () => {
    const countLabel = 'Nombre de joueurs'
    const counts = [1, 2]
    const player1Label = 'Premier rival'
    const player2Label = 'Deuxième rival'
    const characters = ['jessica', 'leto', 'paul', 'duncan']
    const schema = {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          enum: counts,
          metadata: { fs: { name: countLabel } }
        },
        player1: {
          type: 'string',
          enum: characters,
          not: { const: { $data: '/player2' } },
          metadata: { fr: { name: player1Label } }
        }
      },
      if: { properties: { count: { const: 2 } } },
      then: {
        properties: {
          player2: {
            type: 'string',
            enum: characters,
            not: { const: { $data: '/player1' } },
            metadata: { fr: { name: player2Label } }
          }
        }
      }
    }
    await renderComponent(schema)

    let dropdowns = screen.getAllByRole('combobox')
    expect(dropdowns).toHaveLength(2)
    expect(dropdowns[0]).toHaveTextContent(counts[0])
    expect(dropdowns[1]).toHaveTextContent(characters[0])

    await fireEvent.click(dropdowns[0])
    await fireEvent.click(screen.getAllByRole('menuitem')[1])
    await sleep()

    dropdowns = screen.getAllByRole('combobox')
    expect(dropdowns).toHaveLength(3)
    expect(dropdowns[0]).toHaveTextContent(counts[1])
    expect(dropdowns[1]).toHaveTextContent(characters[0])
    expect(dropdowns[2]).toHaveTextContent(characters[1])

    await fireEvent.click(
      screen.getByRole('button', { name: translate('actions.join-game') })
    )
    expect(handleSubmit).toHaveBeenCalledWith({
      count: counts[1],
      player1: characters[0],
      player2: characters[1]
    })
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not populate conditional properties', async () => {
    const countLabel = 'Nombre de joueurs'
    const counts = [1, 2]
    const player1Label = 'Premier rival'
    const player2Label = 'Deuxième rival'
    const characters = ['jessica', 'leto', 'paul', 'duncan']
    const schema = {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          enum: counts,
          metadata: { fs: { name: countLabel } }
        },
        player1: {
          type: 'string',
          enum: characters,
          not: { const: { $data: '/player2' } },
          metadata: { fr: { name: player1Label } }
        }
      },
      if: { properties: { count: { const: 2 } } },
      then: {
        properties: {
          player2: {
            type: 'string',
            enum: characters,
            not: { const: { $data: '/player1' } },
            metadata: { fr: { name: player2Label } }
          }
        }
      }
    }
    await renderComponent(schema)

    let [countDropdown] = screen.getAllByRole('combobox')
    await fireEvent.click(countDropdown)
    await fireEvent.click(screen.getAllByRole('menuitem')[1])

    await fireEvent.click(countDropdown)
    await fireEvent.click(screen.getAllByRole('menuitem')[0])

    await fireEvent.click(
      screen.getByRole('button', { name: translate('actions.join-game') })
    )
    expect(handleSubmit).toHaveBeenCalledWith({
      count: counts[0],
      player1: characters[0]
    })
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })
})
