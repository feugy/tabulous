import { faker } from '@faker-js/faker'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { translate } from '../test-utils'
import FPSViewer from '../../src/connected-components/FPSViewer.svelte'
import { fps } from '../../src/stores/game-engine'

jest.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    fps: new BehaviorSubject(),
    engine: new BehaviorSubject(),
    action: new Subject()
  }
})

describe('FPSViewer connected component', () => {
  beforeEach(jest.resetAllMocks)

  it('displays current frame per seconds', async () => {
    const fps1 = faker.datatype.number()
    fps.next(fps1)
    render(html`<${FPSViewer} />`)
    expect(
      screen.getByText(translate('fps _', { value: fps1 }))
    ).toBeInTheDocument()

    const fps2 = faker.datatype.number()
    fps.next(fps2)
    await tick()
    expect(
      screen.getByText(translate('fps _', { value: fps2 }))
    ).toBeInTheDocument()
  })
})
