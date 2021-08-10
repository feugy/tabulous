<script>
  import Router, { push, replace } from 'svelte-spa-router'
  import { wrap } from 'svelte-spa-router/wrap'
  import Login from './routes/Login.svelte'
  import { currentPlayer, recoverSession } from './stores'

  const routes = {
    '/home': wrap({
      asyncComponent: () => import('./routes/Home.svelte'),
      conditions: [isAuthenticated]
    }),
    '/game/:gameId': wrap({
      asyncComponent: () => import('./routes/Game.svelte'),
      conditions: [isAuthenticated]
    }),
    '/*': Login
  }

  $: if ($currentPlayer === null) {
    push('/login')
  }

  async function isAuthenticated() {
    if ($currentPlayer) return true
    return Boolean(await recoverSession())
  }

  function handleUnauthenticated({ detail }) {
    replace(
      `/login?${new URLSearchParams({ redirect: detail.location }).toString()}`
    )
  }
</script>

<style type="postcss">
</style>

<Router {routes} on:conditionsFailed={handleUnauthenticated} />
