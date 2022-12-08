import Dropdown from '@src/components/Dropdown.svelte'
import { sleep } from '@src/utils'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { extractText } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Dropdown component', () => {
  const handleClose = vi.fn()
  const handleSelect = vi.fn()
  const handleClick = vi.fn()

  beforeEach(vi.resetAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${Dropdown}
        ...${props}
        on:close=${handleClose}
        on:select=${handleSelect}
        on:click=${handleClick}
      />`
    )
  }

  describe.each([
    {
      title: 'textual',
      options: ['Salut !', 'Hello!', 'Hallo !'],
      invalid: 'Hej'
    },
    {
      title: 'object',
      options: [
        { label: 'Salut !' },
        { label: 'Hello!' },
        { label: 'Hallo !' }
      ],
      invalid: { label: 'Hello!' }
    }
  ])('given $title options', ({ options, invalid }) => {
    it('displays menu on click', async () => {
      renderComponent({ options })
      const button = screen.getAllByRole('button')[0]
      expect(button).toHaveTextContent('arrow_drop_down')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      await fireEvent.click(button)

      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(extractText(items)).toEqual(
        options.map(option => option.label ?? option)
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('displays value as text', async () => {
      let value = options[2]
      renderComponent({ value, options, valueAsText: true })
      const button = screen.getAllByRole('button')[0]
      expect(button).toHaveTextContent(options[2]?.label || value)

      await fireEvent.click(button)
      await fireEvent.click(screen.queryAllByRole('menuitem')[0])

      expect(button).toHaveTextContent(options[0].label ?? options[0])
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[0] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('can not display an invalid value', async () => {
      renderComponent({ value: invalid, options, valueAsText: true })
      const button = screen.getAllByRole('button')[0]
      expect(button).toHaveTextContent('arrow_drop_down')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      await fireEvent.click(button)

      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(extractText(items)).toEqual(
        options.map(option => option.label ?? option)
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('selects option with mouse', async () => {
      renderComponent({ options })
      const button = screen.getAllByRole('button')[0]
      await fireEvent.click(button)
      await fireEvent.click(screen.queryAllByRole('menuitem')[2])

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[2] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('selects option with keyboard', async () => {
      renderComponent({ options })
      const button = screen.getAllByRole('button')[0]
      await fireEvent.click(button)
      await fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      await fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[1] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('does not select the current option', async () => {
      renderComponent({ options })
      const button = screen.getAllByRole('button')[0]
      await fireEvent.click(button)
      await fireEvent.click(screen.queryAllByRole('menuitem')[2])
      await fireEvent.click(button)
      await fireEvent.click(screen.queryAllByRole('menuitem')[2])

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[2] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(2)
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('can split button and arrow clicks', async () => {
      renderComponent({ options, openOnClick: false })
      const [button, arrow] = screen.getAllByRole('button')
      await fireEvent.click(arrow)
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(window)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()

      await fireEvent.click(button)
      expect(screen.queryByRole('menu')).toBeNull()

      fireEvent.click(window)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(handleClose).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('closes menu on click', async () => {
      renderComponent({ options })
      const button = screen.getAllByRole('button')[0]
      await fireEvent.click(button)
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(window)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()

      await fireEvent.click(button)
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(button)
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(handleSelect).toHaveBeenCalledTimes(0)
      expect(handleClose).toHaveBeenCalledTimes(2)
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    it('has no arrow on single option', async () => {
      renderComponent({ options: options.slice(0, 1) })
      expect(screen.getAllByRole('button')).toHaveLength(1)
      await fireEvent.click(screen.getByRole('button'))
      expect(screen.queryAllByRole('menuitem')).toHaveLength(1)

      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
      expect(handleClick).toHaveBeenCalledTimes(0)
    })
  })
})
