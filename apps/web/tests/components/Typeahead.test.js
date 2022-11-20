import { faker } from '@faker-js/faker'
import Typeahead from '@src/components/Typeahead.svelte'
import { sleep } from '@src/utils/index.js'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { extractText } from '@tests/test-utils'
import { tick } from 'svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Typeahead component', () => {
  const handleInput = vi.fn()
  const handleChange = vi.fn()
  const value$ = writable()
  const options$ = writable()

  beforeEach(vi.resetAllMocks)

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
      await userEvent.type(input, 'a')
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(extractText(items)).toEqual(
        options.map(option => option.label ?? option)
      )
    })

    it('selects option with mouse and updates value', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a')
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
      await userEvent.type(input, 'a')
      expect(handleInput).toHaveBeenCalledTimes(1)

      await userEvent.type(input, '{ArrowDown}')
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
      await userEvent.type(input, 'a{Backspace}')
      expect(handleInput).toHaveBeenCalledTimes(2)

      await userEvent.type(input, value)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(input).toHaveValue(value)
      expect(handleChange).toHaveBeenCalledTimes(0)
      expect(handleInput).toHaveBeenCalledTimes(2 + value.length)
    })

    it('closes menu with keyboard and opens on focus', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a')
      expect(handleInput).toHaveBeenCalledTimes(1)

      await userEvent.type(input, '{Enter}')
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
