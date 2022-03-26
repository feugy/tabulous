import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import RuleViewer from '../../src/components/RuleViewer.svelte'

describe('RuleViewer component', () => {
  const handleChange = jest.fn()
  const game = 'cards'

  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${RuleViewer} game=${game} ...${props} on:change=${handleChange} />`
    )
  }

  it('displays first page', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const [previous, next] = screen.queryAllByRole('button')
    expect(image).toHaveAttribute('src', `games/${game}/rules/1.webp`)
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('navigates upward up to the last page', async () => {
    renderComponent({ lastPage: 2 })
    const image = screen.queryByRole('img')
    const [previous, next] = screen.queryAllByRole('button')
    expect(image).toHaveAttribute('src', `games/${game}/rules/1.webp`)
    expect(handleChange).not.toHaveBeenCalled()

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute('src', `games/${game}/rules/2.webp`)
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ detail: { page: 1 } })
    )

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute('src', `games/${game}/rules/3.webp`)
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
    expect(image).toHaveAttribute('src', `games/${game}/rules/1.webp`)
    expect(handleChange).not.toHaveBeenCalled()

    fireEvent.click(next)
    await tick()
    expect(image).toHaveAttribute('src', `games/${game}/rules/2.webp`)
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ detail: { page: 1 } })
    )

    fireEvent.click(previous)
    await tick()
    expect(image).toHaveAttribute('src', `games/${game}/rules/1.webp`)
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    expect(handleChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ detail: { page: 0 } })
    )
    expect(handleChange).toHaveBeenCalledTimes(2)
  })
})
