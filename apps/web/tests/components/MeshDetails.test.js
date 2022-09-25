import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import MeshDetails from '../../src/components/MeshDetails.svelte'
import { gameAssetsUrl, sleep } from '../../src/utils'

describe('MeshDetails component', () => {
  const handleClose = vi.fn()
  const handleOpen = vi.fn()

  const mesh1 = { image: '/image1.webp' }

  function renderComponent(props = {}) {
    return render(
      html`<${MeshDetails}
        ...${props}
        on:close=${handleClose}
        on:open=${handleOpen}
      />`
    )
  }

  beforeEach(vi.resetAllMocks)

  it('displays a mesh image', async () => {
    renderComponent({ mesh: mesh1 })
    const image = screen.queryByRole('img')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', `${gameAssetsUrl}${mesh1.image}`)
    expect(handleOpen).toHaveBeenCalledTimes(1)
    expect(handleClose).not.toHaveBeenCalled()
  })

  describe('given being open', () => {
    let image

    beforeEach(() => {
      renderComponent({ mesh: mesh1 })
      image = screen.getByRole('img')
      handleOpen.mockReset()
    })

    it('closes on click', async () => {
      fireEvent.click(image)
      await tick()
      expect(image).not.toBeInTheDocument()
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on key', async () => {
      await sleep(200)
      fireEvent.keyDown(image, { key: 'a' })
      await tick()
      expect(image).not.toBeInTheDocument()
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('does not immediately close on key', async () => {
      fireEvent.keyDown(image, { key: 'a' })
      await tick()
      expect(image).toBeInTheDocument()
      expect(handleClose).not.toHaveBeenCalled()
    })
  })
})
