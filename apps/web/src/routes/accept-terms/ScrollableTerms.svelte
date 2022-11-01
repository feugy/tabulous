<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { TermsOfService } from '../../components'

  const dispatch = createEventDispatcher()
  let delimiter
  let intersectionObserver = null

  onMount(() => {
    intersectionObserver = new IntersectionObserver(function (entries) {
      if (entries[0].intersectionRatio > 0) {
        dispatch('end')
        unwireObserver()
      }
    })
    intersectionObserver.observe(delimiter)
  })

  onDestroy(unwireObserver)

  function unwireObserver() {
    intersectionObserver?.disconnect()
    intersectionObserver = null
  }
</script>

<div>
  <TermsOfService withTitle={false} />
  <hr bind:this={delimiter} />
</div>

<style lang="postcss">
  div {
    @apply overflow-y-auto;
    flex-shrink: 1;
  }
  hr {
    @apply invisible;
  }
</style>
