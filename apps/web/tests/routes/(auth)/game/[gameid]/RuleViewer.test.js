import RuleViewer from '@src/routes/(auth)/game/[gameId]/RuleViewer.svelte'
import { gameAssetsUrl } from '@src/utils'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('/game/[gameId] RuleViewer component', () => {
  const handleChange = vi.fn()
  const game = 'cards'

  beforeEach(vi.resetAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${RuleViewer} game=${game} ...${props} on:change=${handleChange} />`
    )
  }

  it('displays first page', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const [previous, next] = screen.queryAllByRole('button')
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/1.webp`
    )
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('navigates upward up to the last page', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const [previous, next] = screen.queryAllByRole('button')
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/1.webp`
    )
    expect(handleChange).not.toHaveBeenCalled()

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/2.webp`
    )
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ detail: { page: 1 } })
    )

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/3.webp`
    )
    expect(previous).toBeEnabled()
    expect(next).toBeDisabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ detail: { page: 2 } })
    )
    expect(handleChange).toHaveBeenCalledTimes(2)
  })

  it('navigates backward up to the first page', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const [previous, next] = screen.queryAllByRole('button')
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/1.webp`
    )
    expect(handleChange).not.toHaveBeenCalled()

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/2.webp`
    )
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ detail: { page: 1 } })
    )

    fireEvent.click(previous)
    await tick()
    expect(image).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game}/rules/1.webp`
    )
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ detail: { page: 0 } })
    )
    expect(handleChange).toHaveBeenCalledTimes(2)
  })

  it('pans the imagee', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    image.getBoundingClientRect = () => ({ width: 300, height: 500 })
    fireEvent.load(image)
    const container = image.parentElement
    expect(container.scrollTop).toBe(0)
    expect(container.scrollLeft).toBe(0)
    const downEvent = new Event('pointerdown')
    Object.assign(downEvent, { clientX: 100, clientY: 100 })
    fireEvent(container, downEvent)
    const moveEvent = new Event('pointermove')
    Object.assign(moveEvent, { clientX: 50, clientY: 75 })
    fireEvent(window, moveEvent)
    fireEvent.pointerUp(image)
    expect(container.scrollTop).toBe(25)
    expect(container.scrollLeft).toBe(50)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('zooms the image out and in', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const width = 300
    const height = 500
    image.getBoundingClientRect = () => ({ width, height })
    fireEvent.load(image)
    expect(image).toHaveStyle({
      width: `90px`,
      height: `150px`
    })
    fireEvent.wheel(image.parentElement, { deltaY: -10 })
    fireEvent.wheel(image.parentElement, { deltaY: -5 })
    expect(image).toHaveStyle({
      width: `150px`,
      height: `250px`
    })
    fireEvent.wheel(image.parentElement, { deltaY: 5 })
    expect(image).toHaveStyle({
      width: `120px`,
      height: `200px`
    })
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('can not zoom the image to far', async () => {
    const minZoom = 0.5
    renderComponent({ minZoom })
    const image = screen.queryByRole('img')
    const width = 300
    const height = 500
    image.getBoundingClientRect = () => ({ width, height })
    fireEvent.load(image)
    for (let i = 0; i < 20; i++) {
      fireEvent.wheel(image.parentElement, { deltaY: 1 })
    }
    expect(image).toHaveStyle({
      width: `${width * minZoom}px`,
      height: `${height * minZoom}px`
    })
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('can not zoom the image to close', async () => {
    const maxZoom = 1.6
    renderComponent({ maxZoom })
    const image = screen.queryByRole('img')
    const width = 300
    const height = 500
    image.getBoundingClientRect = () => ({ width, height })
    fireEvent.load(image)
    for (let i = 0; i < 20; i++) {
      fireEvent.wheel(image.parentElement, { deltaY: -1 })
    }
    expect(image).toHaveStyle({
      width: `${width * maxZoom}px`,
      height: `${height * maxZoom}px`
    })
    expect(handleChange).not.toHaveBeenCalled()
  })
})
