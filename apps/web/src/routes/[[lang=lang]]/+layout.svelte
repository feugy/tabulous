<script>
  // @ts-check
  import { Toaster } from '@src/components'
  import { lastToast } from '@src/stores'
</script>

<slot />
<Toaster message={$lastToast} />
