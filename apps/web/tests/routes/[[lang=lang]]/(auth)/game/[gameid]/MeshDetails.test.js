// @ts-check
import MeshDetails from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/MeshDetails.svelte'
import { gameAssetsUrl } from '@src/utils'
import { render, screen } from '@testing-library/svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('/game/[gameId] MeshDetails component', () => {
  /** @type {import('@src/3d/managers').MeshDetails} */
  const details = { position: { x: 250, y: 120 }, images: ['/image1.webp'] }

  function renderComponent(props = {}) {
    return render(html`<${MeshDetails} ...${props} />`)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays a mesh image', () => {
    renderComponent({ details })
    const imageElement = screen.queryByRole('img')
    expect(imageElement).toBeInTheDocument()
    expect(imageElement).toHaveAttribute(
      'src',
      `${gameAssetsUrl}${details.images[0]}`
    )
  })

  it('displays a multiple images', () => {
    const images = ['/image1.webp', '/image2.webp', '/image3.webp']
    renderComponent({ details: { ...details, images } })
    const imageElements = screen.queryAllByRole('img')
    expect(imageElements).toHaveLength(images.length)
    for (const [i, image] of images.entries()) {
      expect(imageElements[i]).toHaveAttribute(
        'src',
        `${gameAssetsUrl}${image}`
      )
    }
  })
})
