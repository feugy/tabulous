import { faker } from '@faker-js/faker'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import { writable } from 'svelte/store'
import html from 'svelte-htm'
import LogInForm from '../../src/components/LogInForm.svelte'
import { translate } from '../test-utils'

describe('LogIn component', () => {
  const username$ = writable()
  const password$ = writable()
  const handleSubmit = jest.fn()

  beforeAll(() => {
    global.window = Object.create(window)
    Object.defineProperty(window, 'location', {
      value: { href: '' }
    })
  })

  beforeEach(() => {
    jest.resetAllMocks()
    username$.set()
    password$.set()
  })

  afterAll(() => (global.window = undefined))

  function renderComponent(props = {}) {
    return render(
      html`<${LogInForm}
        bind:username=${username$}
        bind:password=${password$}
        ...${props}
        on:submit=${handleSubmit}
      />`
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
      expect(global.window.location.href).toEqual(`/auth/${provider}/connect`)
    })

    it(`navigates to ${provider} authentication with redirect`, async () => {
      const redirect = faker.internet.url()
      renderComponent({ ...props, redirect })
      await fireEvent.click(
        screen.getByRole('button', {
          name: translate(`actions.log-in-${provider}`)
        })
      )
      expect(global.window.location.href).toEqual(
        `/auth/${provider}/connect?redirect=${encodeURIComponent(redirect)}`
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
      { title: 'empty username', init: () => password$.set('abcd') },
      { title: 'empty password', init: () => username$.set('jane') },
      {
        title: 'blank password',
        init: () => {
          username$.set('jane')
          password$.set('  ')
        }
      },
      {
        title: 'blank username',
        init: () => {
          username$.set('   ')
          password$.set('abcd')
        }
      }
    ])('has disabled button with $title', ({ init }) => {
      init()
      renderComponent()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('submits username and password', async () => {
      const username = faker.name.findName()
      const password = faker.internet.password()
      renderComponent()
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleSubmit).not.toHaveBeenCalled()

      username$.set(username)
      password$.set(password)
      await tick()
      expect(button).toBeEnabled()
      await fireEvent.click(button)

      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { username, password }
        })
      )
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    it.each([
      {
        title: 'username change',
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
      const error = faker.name.findName()
      renderComponent({ error })
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getByText(error)).toBeInTheDocument()

      await change()
      await tick()
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.queryByText(error)).not.toBeInTheDocument()
      expect(handleSubmit).not.toHaveBeenCalled()
    })
  })
})
