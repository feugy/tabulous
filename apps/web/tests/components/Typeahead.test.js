// @ts-check
/**
 * @typedef {import('@src/components').MenuOption} MenuOption
 */

import { faker } from '@faker-js/faker'
import Typeahead from '@src/components/Typeahead.svelte'
import { sleep } from '@src/utils/index.js'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { extractText, getMenuOptionValue } from '@tests/test-utils'
import { tick } from 'svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Typeahead component', () => {
  const handleInput = vi.fn()
  const handleChange = vi.fn()
  const value$ = writable()
  const options$ = writable()

  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  describe.each(
    /** @type {[string, MenuOption[]][]} */ ([
      ['textual', ['Salut !', 'Hello!', 'Hallo !']],
      [
        'object',
        [{ label: 'Salut !' }, { label: 'Hello!' }, { label: 'Hallo !' }]
      ]
    ])
  )('given %s options', (title, options) => {
    beforeEach(() => {
      value$.set('')
      options$.set(undefined)
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
      expect(handleInput).toHaveBeenCalledOnce()
      expect(screen.queryByRole('menu')).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(extractText(items)).toEqual(options.map(getMenuOptionValue))
    })

    it('selects option with mouse and updates value', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a')
      expect(handleInput).toHaveBeenCalledOnce()

      fireEvent.click(screen.queryAllByRole('menuitem')[2])
      await tick()
      expect(input).toHaveValue(getMenuOptionValue(options[2]))
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledOnce()
    })

    it('selects option with keyboard and updates value', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a')
      expect(handleInput).toHaveBeenCalledOnce()

      await userEvent.type(input, '{ArrowDown}')
      fireEvent.keyDown(/** @type {HTMLElement} */ (document.activeElement), {
        key: 'ArrowDown'
      })
      await tick()
      fireEvent.keyDown(/** @type {HTMLElement} */ (document.activeElement), {
        key: 'ArrowRight'
      })
      await tick()
      expect(input).toHaveValue(getMenuOptionValue(options[1]))
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledOnce()
    })

    it('selects option by typing its value', async () => {
      const value = getMenuOptionValue(options[2])
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a{Backspace}')
      expect(handleInput).toHaveBeenCalledTimes(2)

      await userEvent.type(input, `${value}{Enter}`)
      expect(input).toHaveValue(value)
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledTimes(2 + value.length)
    })

    it('selects first option on enter', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, `a{Enter}`)
      expect(input).toHaveValue(getMenuOptionValue(options[0]))
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledOnce()
    })

    it('closes menu with keyboard and opens on focus', async () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      handleInput.mockImplementation(async () => options$.set(options))
      await userEvent.type(input, 'a')
      expect(handleInput).toHaveBeenCalledOnce()

      await userEvent.type(input, '{Enter}')
      await sleep(100)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(handleChange).not.toHaveBeenCalled()
      expect(handleInput).toHaveBeenCalledOnce()

      fireEvent.focus(input)
      await tick()
      expect(screen.queryByRole('menu')).toBeInTheDocument()
    })
  })
})
