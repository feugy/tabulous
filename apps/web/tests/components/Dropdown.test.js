import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import Dropdown from '../../src/components/Dropdown.svelte'
import { sleep } from '../../src/utils/index.js'

describe('Dropdown component', () => {
  const handleClose = jest.fn()
  const handleSelect = jest.fn()

  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${Dropdown}
        ...${props}
        on:close=${handleClose}
        on:select=${handleSelect}
      />`
    )
  }

  describe.each([
    ['textual', ['Salut !', 'Hello!', 'Hallo !']],
    [
      'object',
      [{ label: 'Salut !' }, { label: 'Hello!' }, { label: 'Hallo !' }]
    ]
  ])('given %s options', (title, options) => {
    it('displays menu on click', async () => {
      renderComponent({ options })
      const button = screen.getByRole('button')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      fireEvent.click(button)
      await tick()

      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(items.map(item => item.textContent.trim())).toEqual(
        options.map(option => option.label ?? option)
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('displays value as text', async () => {
      let value = options[2].label ?? options[2]
      renderComponent({ value, options, valueAsText: true })
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent(value)

      fireEvent.click(button)
      await tick()
      fireEvent.click(screen.queryAllByRole('menuitem')[0])
      await tick()

      expect(button).toHaveTextContent(options[0].label ?? options[0])
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[0] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('selects option with mouse', async () => {
      renderComponent({ options })
      const button = screen.getByRole('button')
      fireEvent.click(button)
      await tick()
      fireEvent.click(screen.queryAllByRole('menuitem')[2])
      await tick()

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[2] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('selects option with keyboard', async () => {
      renderComponent({ options })
      const button = screen.getByRole('button')
      fireEvent.click(button)
      await tick()
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      await tick()
      fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })
      await tick()

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[1] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes menu on click', async () => {
      renderComponent({ options })
      const button = screen.getByRole('button')
      fireEvent.click(button)
      await tick()
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(window)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()

      fireEvent.click(button)
      await tick()
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(button)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(handleSelect).toHaveBeenCalledTimes(0)
      expect(handleClose).toHaveBeenCalledTimes(2)
    })
  })
})
