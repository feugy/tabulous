<script>
  import { _ } from 'svelte-intl'
  import { fps } from '../stores'
</script>

<div>{$_('fps _', { value: $fps })}</div>

<style lang="postcss">
  div {
    @apply absolute z-10 block bg-$base-lightest left-2 bottom-2 p-2 shadow-lg;
  }
</style>
