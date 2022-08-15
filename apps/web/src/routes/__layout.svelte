<script context="module">
  import { browser } from '$app/env'
  import { initGraphQLGlient } from '../stores'
  import { graphQlUrl } from '../utils'

  export async function load({ session, fetch }) {
    initGraphQLGlient({
      graphQlUrl,
      fetch,
      bearer: session.bearer,
      subscriptionSupport: browser
    })
    return { status: 200 }
  }
</script>

<script>
  import '../common'
</script>

<slot />
