<script>
  import { Toaster } from '@src/components'
  import { lastToast } from '@src/stores'
  
  import { initLocale } from '../common'

  /** @type {import('./$types').LayoutData} */
  export let data

  initLocale(data.timeZone)
</script>

<slot />
<Toaster message={$lastToast} />
