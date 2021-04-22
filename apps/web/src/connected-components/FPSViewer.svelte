<script>
  import { _ } from 'svelte-intl'
  import { fps } from '../stores/engine'
</script>

<style type="postcss">
  div {
    @apply absolute z-10 block bg-white right-2 top-2 p-2;
  }
</style>

<div>{$_('fps _', { value: $fps })}</div>
