import { fireEvent, render, screen } from '@testing-library/svelte'
import faker from 'faker'
import html from 'svelte-htm'
import { translate } from '../test-utils'

let ActionMenu
const mockScreenPosition = { x: 0, y: 0 }

jest.mock('../../src/3d/utils', () => ({
  getMeshScreenPosition: () => mockScreenPosition
}))

beforeAll(async () => {
  ActionMenu = (await import('../../src/components/ActionMenu.svelte')).default
})

describe('Action Menu component', () => {
  beforeEach(jest.resetAllMocks)

  const playerId = faker.datatype.uuid()

  function renderComponent(props = { mesh: null }) {
    return render(html`<${ActionMenu} playerId=${playerId} ...${props} />`)
  }

  it('is hidden with no mesh', () => {
    renderComponent()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('displays nothing on mesh with no behavior', async () => {
    renderComponent({ mesh: { metadata: {} } })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it.each([
    { title: 'flippable mesh', functionName: 'flip', icon: 'flip', args: [] },
    {
      title: 'rotable mesh',
      functionName: 'rotate',
      icon: 'rotate_right',
      args: []
    },
    {
      title: 'detailable mesh',
      functionName: 'detail',
      icon: 'visibility',
      args: []
    },
    {
      title: 'drawable mesh',
      functionName: 'draw',
      icon: 'front_hand',
      args: [playerId]
    }
  ])('has action for a $title', async ({ functionName, icon, args }) => {
    const metadata = { [functionName]: jest.fn() }
    renderComponent({ mesh: { metadata } })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent(icon)
    expect(buttons[0]).toHaveAttribute(
      'title',
      translate(`tooltips.${functionName}`)
    )
    fireEvent.click(buttons[0])
    expect(metadata[functionName]).toHaveBeenCalledTimes(1)
    expect(metadata[functionName]).toHaveBeenCalledWith(...args)
  })

  it('has action for a stackable mesh', async () => {
    const metadata = {
      stack: [{ id: '1' }, { id: '2' }, { id: '3' }],
      reorder: jest.fn()
    }
    renderComponent({ mesh: { metadata } })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('shuffle')
    expect(buttons[0]).toHaveAttribute('title', translate('tooltips.shuffle'))
    fireEvent.click(buttons[0])
    expect(metadata.reorder).toHaveBeenCalledTimes(1)
    expect(metadata.reorder).toHaveBeenCalledWith(
      expect.arrayContaining(['3', '2', '1'])
    )
  })

  it('displays multiple actions', async () => {
    const metadata = { detail: jest.fn(), rotate: jest.fn(), flip: jest.fn() }
    renderComponent({ mesh: { metadata } })
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(3)
    fireEvent.click(
      screen.getByRole('button', { name: translate('tooltips.flip') })
    )
    expect(metadata.flip).toHaveBeenCalledTimes(1)
    expect(metadata.detail).not.toHaveBeenCalled()
    expect(metadata.rotate).not.toHaveBeenCalled()
  })
})
