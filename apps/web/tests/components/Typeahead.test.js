import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import faker from 'faker'
import { tick } from 'svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import Typeahead from '../../src/components/Typeahead.svelte'
import { sleep } from '../../src/utils/index.js'

describe('Typeahead component', () => {
  const handleInput = jest.fn()
  const handleChange = jest.fn()
  const value$ = writable()
  const options$ = writable()

  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${Typeahead}
        bind:value=${value$}
        bind:options="${options$}"
        ...${props}
        on:input=${handleInput}
        on:change=${handleChange}
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
    beforeEach(() => {
      value$.set('')
      options$.set()
    })

    it('triggers input event displays menu', async () => {
      const value = faker.lorem.word()
      value$.set(value)
      renderComponent()
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue(value)
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()

      handleInput.mockImplementation(async () => options$.set(options))
      userEvent.type(input, 'a')
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledTimes(1)
      await tick()
      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(items.map(item => item.textContent.trim())).toEqual(
        options.map(option => option.label ?? option)
      )
    })

    it('selects option with mouse and updates value', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      userEvent.type(input, 'a')
      await tick()
      expect(handleInput).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.queryAllByRole('menuitem')[2])
      await tick()
      expect(input).toHaveValue(options[2].label ?? options[2])
      expect(handleChange).toHaveBeenCalledTimes(0)
      expect(handleInput).toHaveBeenCalledTimes(1)
    })

    it('selects option with keyboard and updates value', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      userEvent.type(input, 'a')
      await tick()
      expect(handleInput).toHaveBeenCalledTimes(1)

      userEvent.type(input, '{arrowdown}')
      await tick()
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      await tick()
      fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })
      await tick()
      expect(input).toHaveValue(options[1].label ?? options[1])
      expect(handleChange).toHaveBeenCalledTimes(0)
      expect(handleInput).toHaveBeenCalledTimes(1)
    })

    it('selects option by typing its value', async () => {
      const value = options[2].label ?? options[2]
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      userEvent.type(input, 'a{backspace}')
      await tick()
      expect(handleInput).toHaveBeenCalledTimes(2)

      userEvent.type(input, value)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(input).toHaveValue(value)
      expect(handleChange).toHaveBeenCalledTimes(0)
      expect(handleInput).toHaveBeenCalledTimes(2 + value.length)
    })

    it('closes menu with keyboard and opens on focus', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      userEvent.type(input, 'a')
      await tick()
      expect(handleInput).toHaveBeenCalledTimes(1)

      userEvent.type(input, '{enter}')
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(handleChange).toHaveBeenCalledTimes(0)
      expect(handleInput).toHaveBeenCalledTimes(1)

      fireEvent.focus(input)
      await tick()
      expect(screen.queryByRole('menu')).toBeInTheDocument()
    })
  })
})
