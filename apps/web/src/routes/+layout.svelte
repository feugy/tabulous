<script>
  import { browser } from '$app/env'
  import '../common'
  import { initGraphQLGlient } from '../stores'
  import { graphQlUrl } from '../utils'

  /** @type {import('./$types').LayoutData} */
  export let data

  initGraphQLGlient({
    graphQlUrl,
    fetch,
    bearer: data.bearer,
    subscriptionSupport: browser
  })
</script>

<slot />
