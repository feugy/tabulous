import { faker } from '@faker-js/faker'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it } from 'vitest'

import Toaster from '../../src/components/Toaster/index.js'
import { sleep } from '../../src/utils'

describe('Toaster component', () => {
  const messages$ = writable()

  beforeEach(() => {
    messages$.set([])
  })

  function renderComponent() {
    return render(html`<${Toaster} bind:messages=${messages$} />`)
  }

  it('shows and hide single message', async () => {
    const content = faker.lorem.words()
    messages$.set([{ content, duration: 1 }])
    renderComponent()
    expect(screen.getByText(content)).toBeInTheDocument()
    await sleep(1100)
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it('shows and hide multiple message', async () => {
    const content1 = faker.lorem.words()
    const content2 = faker.lorem.words()
    messages$.set([{ content: content1, duration: 1 }])
    renderComponent()
    expect(screen.getByText(content1)).toBeInTheDocument()
    await sleep(500)
    messages$.update(messages => [
      ...messages,
      { content: content2, duration: 1 }
    ])
    await sleep(100)
    expect(screen.getByText(content1)).toBeInTheDocument()
    expect(screen.getByText(content2)).toBeInTheDocument()
    await sleep(500)
    expect(screen.queryByText(content1)).not.toBeInTheDocument()
    expect(screen.getByText(content2)).toBeInTheDocument()
    await sleep(500)
    expect(screen.queryByText(content2)).not.toBeInTheDocument()
  })

  it('closes message on demand', async () => {
    const content1 = faker.lorem.words()
    const content2 = faker.lorem.words()
    messages$.set([
      { content: content1, duration: 1 },
      { content: content2, duration: 1 }
    ])
    renderComponent()
    expect(screen.getByText(content1)).toBeInTheDocument()
    expect(screen.getByText(content2)).toBeInTheDocument()
    await sleep(100)
    await fireEvent.click(screen.getAllByRole('button')[0])
    await sleep(200)
    // unfortunately, since it's all managed by css animations, we can't assert element's visibility
    expect(screen.getByText(content1).parentElement).toHaveClass('hide')
    expect(screen.getByText(content2)).toBeInTheDocument()
    await sleep(800)
    expect(screen.queryByText(content2)).not.toBeInTheDocument()
  })
})
