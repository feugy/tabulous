<script context="module">
  import { browser } from '$app/env'
  import { get } from 'svelte/store'
  import { currentPlayer, recoverSession } from '../stores'

  export async function load({ url }) {
    if (!browser) return { status: 200 }
    if (
      url.pathname !== '/login' &&
      !get(currentPlayer) &&
      !(await recoverSession())
    ) {
      const location = new URL('/login', url.href)
      location.searchParams.set('redirect', url.href.replace(url.origin, ''))
      return { status: 302, redirect: location.href }
    }
    return { status: 200 }
  }
</script>

<script>
  import '../common'
</script>

<slot />
