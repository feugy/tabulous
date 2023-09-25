// @ts-check
import MinimizableSection from '@src/components/MinimizableSection.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('MinimizableSection component', () => {
  const handleMinimize = vi.fn()
  const handleChange = vi.fn()
  const handleResize = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe.each([
    ['top', 75],
    ['left', 50],
    ['bottom', -75],
    ['right', -50]
  ])('given a %s placement', (placement, size) => {
    function renderComponent(props = {}) {
      return render(
        html`<${MinimizableSection}
          placement=${placement}
          ...${props}
          on:minimize=${handleMinimize}
          on:resize=${handleResize}
          on:change=${handleChange}
        />`
      )
    }

    it('collapses and expands on click', async () => {
      renderComponent()

      const tab = screen.getByRole('tab')
      expect(tab).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(tab)
      await tick()
      expect(tab).toHaveAttribute('aria-expanded', 'false')
      expect(handleMinimize).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ detail: { minimized: true } })
      )

      fireEvent.click(screen.getByRole('tab'))
      await tick()
      expect(tab).toHaveAttribute('aria-expanded', 'true')
      expect(handleMinimize).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ detail: { minimized: false } })
      )
      expect(handleMinimize).toHaveBeenCalledTimes(2)
    })

    it('can resize', async () => {
      renderComponent()
      const gutter = /** @type {HTMLElement} */ (
        screen.queryByRole('scrollbar')
      )
      const downEvent = new Event('pointerdown')
      Object.assign(downEvent, { x: 100, y: 200 })
      fireEvent(gutter, downEvent)
      const moveEvent = new Event('pointermove')
      Object.assign(moveEvent, {
        movementX: 50,
        movementY: 75,
        x: 150,
        y: 275
      })
      fireEvent(window, moveEvent)
      fireEvent.pointerUp(gutter)
      await tick()
      expect(handleResize).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { size } })
      )
      expect(handleResize).toHaveBeenCalledTimes(1)
      expect(handleMinimize).not.toHaveBeenCalled()
    })

    it('can start minimized', () => {
      renderComponent({ minimized: true })
      expect(screen.getByRole('tab')).toHaveAttribute('aria-expanded', 'false')
    })

    it('can not resize when minimized', async () => {
      renderComponent({ minimized: true })
      const gutter = /** @type {HTMLElement} */ (
        screen.queryByRole('scrollbar')
      )
      const downEvent = new Event('pointerdown')
      Object.assign(downEvent, { x: 100, y: 200 })
      fireEvent(gutter, downEvent)
      const moveEvent = new Event('pointermove')
      Object.assign(moveEvent, {
        movementX: 50,
        movementY: 75,
        x: 150,
        y: 275
      })
      fireEvent(window, moveEvent)
      fireEvent.pointerUp(gutter)
      await tick()
      expect(handleResize).not.toHaveBeenCalled()
      expect(handleMinimize).not.toHaveBeenCalled()
    })

    describe('given some tabs', () => {
      /** @type {HTMLElement[]} */
      let tabs

      beforeEach(() => {
        renderComponent({
          tabs: [
            { icon: 'help' },
            { icon: 'people', key: 'F11' },
            { icon: 'start' }
          ]
        })
        tabs = screen.queryAllByRole('tab')
      })

      it('has first tab active', () => {
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
        expect(handleChange).not.toHaveBeenCalled()
      })

      it('changes tab when clicking inactive tab', async () => {
        fireEvent.click(tabs[2])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { currentTab: 2 } })
        )
        expect(handleChange).toHaveBeenCalledTimes(1)
      })

      it('minimize when clicking active tab', async () => {
        fireEvent.click(tabs[0])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(handleMinimize).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { minimized: true } })
        )
        expect(handleMinimize).toHaveBeenCalledTimes(1)
        expect(handleChange).not.toHaveBeenCalled()
      })

      it('expands and changes tab when clicking inactive, minimized tab', async () => {
        fireEvent.click(tabs[0])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(handleMinimize).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ detail: { minimized: true } })
        )
        expect(handleChange).not.toHaveBeenCalled()

        fireEvent.click(tabs[1])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
        expect(handleMinimize).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ detail: { minimized: false } })
        )

        expect(handleMinimize).toHaveBeenCalledTimes(2)
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { currentTab: 1 } })
        )
        expect(handleChange).toHaveBeenCalledTimes(1)
      })

      it('expands and changes tab on tab key', async () => {
        fireEvent.click(tabs[0])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(handleMinimize).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ detail: { minimized: true } })
        )
        expect(handleChange).not.toHaveBeenCalled()

        fireEvent.keyDown(window, { key: 'F11' })
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
        expect(handleMinimize).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ detail: { minimized: false } })
        )

        expect(handleMinimize).toHaveBeenCalledTimes(2)
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { currentTab: 1 } })
        )
        expect(handleChange).toHaveBeenCalledTimes(1)
      })

      it('ignores tab keys when fired from an Input element', async () => {
        fireEvent.click(tabs[0])
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(handleMinimize).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ detail: { minimized: true } })
        )
        expect(handleChange).not.toHaveBeenCalled()
        handleMinimize.mockClear()

        const input = document.createElement('input')
        document.body.append(input)
        fireEvent.keyDown(input, { key: 'F11' })
        await tick()
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
        expect(handleMinimize).not.toHaveBeenCalled()
        expect(handleChange).not.toHaveBeenCalled()
      })
    })
  })
})
