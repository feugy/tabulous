<script>
  import { browser } from '$app/env'
  import '../common'
  import { initGraphQlClient } from '../stores'
  import { graphQlUrl } from '../utils'

  /** @type {import('./$types').LayoutData} */
  export let data

  initGraphQlClient({
    graphQlUrl,
    fetch,
    bearer: data.bearer,
    subscriptionSupport: browser
  })
</script>

<slot />
