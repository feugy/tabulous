<script>
  import '../common'
  
  import { PageFooter, Toaster } from '../components'
  import { lastToast } from '../stores'
</script>

<slot />
<Toaster message={$lastToast} />
<PageFooter />
