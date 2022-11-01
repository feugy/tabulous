import { faker } from '@faker-js/faker'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import Form from '../../../src/routes/login/Form.svelte'
import { authUrl } from '../../../src/utils'
import { translate } from '../../test-utils'

describe('Login Form component', () => {
  const id$ = writable()
  const password$ = writable()
  const origin = 'https://localhost:3000'
  const windowSav = global.window

  beforeAll(() => {
    global.window = Object.create(window)
    Object.defineProperty(window, 'location', {
      value: { href: '', origin }
    })
  })

  beforeEach(() => {
    vi.resetAllMocks()
    id$.set()
    password$.set()
  })

  afterAll(() => {
    global.window = windowSav
  })

  function renderComponent(props = {}) {
    return render(
      html`<${Form} bind:id=${id$} bind:password=${password$} ...${props} />`
    )
  }

  describe.each([
    { provider: 'github', props: { withGithub: true } },
    { provider: 'google', props: { withGoogle: true } }
  ])('given $provider provider', ({ provider, props }) => {
    it(`displays ${provider} button and hides password option`, () => {
      renderComponent(props)
      const button = screen.getByRole('button', {
        name: translate(`actions.log-in-${provider}`)
      })
      expect(button).toBeInTheDocument()
      expect(screen.getByRole('group', { name: '' })).not.toHaveAttribute(
        'open'
      )
      const passwordToggle = screen.getByTitle('password-toggle')
      expect(passwordToggle).not.toHaveClass('hidden')
      expect(passwordToggle).toHaveTextContent(
        `arrow_forward${translate('actions.log-in-password')}`
      )
    })

    it(`navigates to ${provider} authentication`, async () => {
      renderComponent(props)
      await fireEvent.click(
        screen.getByRole('button', {
          name: translate(`actions.log-in-${provider}`)
        })
      )
      expect(global.window.location.href).toEqual(
        `${authUrl}/${provider}/connect?redirect=${encodeURIComponent(origin)}`
      )
    })

    it(`navigates to ${provider} authentication with redirect`, async () => {
      const redirect = `/${faker.internet.domainWord()}`
      renderComponent({ ...props, redirect })
      await fireEvent.click(
        screen.getByRole('button', {
          name: translate(`actions.log-in-${provider}`)
        })
      )
      expect(global.window.location.href).toEqual(
        `${authUrl}/${provider}/connect?redirect=${encodeURIComponent(
          `${origin}${redirect}`
        )}`
      )
    })

    it(`hides ${provider} button when toggling password options`, async () => {
      const user = userEvent.setup()
      renderComponent(props)
      const passwordToggle = screen.getByTitle('password-toggle')
      const details = screen.getByRole('group', { name: '' })
      await user.click(passwordToggle)

      expect(details).toHaveAttribute('open')
      expect(passwordToggle).toHaveTextContent(
        `arrow_back${translate('actions.log-in-others')}`
      )
      expect(screen.getByRole('button')).toHaveTextContent(
        `emoji_people${translate('actions.log-in')}`
      )

      await user.click(passwordToggle)
      expect(details).not.toHaveAttribute('open')
      expect(passwordToggle).toHaveTextContent(
        `arrow_forward${translate('actions.log-in-password')}`
      )
      expect(
        screen.queryByRole('button', {
          name: translate(`actions.log-in-${provider}`)
        })
      ).toBeInTheDocument()
    })
  })

  describe('given no external providers', () => {
    it('has password details opened by default', () => {
      renderComponent()
      const details = screen.getByRole('group', { name: '' })
      expect(details).toHaveAttribute('open')
      expect(screen.getByTitle('password-toggle')).toHaveClass('hidden')
    })

    it.each([
      { title: 'empty id', init: () => password$.set('abcd') },
      { title: 'empty password', init: () => id$.set('jane') },
      {
        title: 'blank password',
        init: () => {
          id$.set('jane')
          password$.set('  ')
        }
      },
      {
        title: 'blank id',
        init: () => {
          id$.set('   ')
          password$.set('abcd')
        }
      }
    ])('has disabled button with $title', ({ init }) => {
      init()
      renderComponent()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it.each([
      {
        title: 'id change',
        async change() {
          await fireEvent.input(screen.getByRole('textbox'))
        }
      },
      {
        title: 'password change',
        async change() {
          await fireEvent.input(screen.getByTestId('password'))
        }
      }
    ])('hides error on $title', async ({ change }) => {
      const error = faker.name.fullName()
      renderComponent({ error })
      expect(screen.getByText(error)).toBeInTheDocument()

      await change()
      await tick()
      expect(screen.queryByText(error)).not.toBeInTheDocument()
    })
  })
})
