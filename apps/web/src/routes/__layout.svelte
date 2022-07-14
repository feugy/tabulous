<script context="module">
  import { browser } from '$app/env'
  import { recoverSession } from '../stores'

  export async function load() {
    if (browser) {
      await recoverSession()
    }
    return { status: 200 }
  }
</script>

<script>
  import '../common'
</script>

<slot />
