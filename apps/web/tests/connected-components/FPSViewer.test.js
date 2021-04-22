import { render, screen } from '@testing-library/svelte'
import faker from 'faker'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { translate } from '../test-utils'
import FPSViewer from '@src/connected-components/FPSViewer.svelte'
import { fps } from '@src/stores/engine'

jest.mock('@src/stores/engine', () => ({
  fps: new (require('rxjs').BehaviorSubject)()
}))

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
