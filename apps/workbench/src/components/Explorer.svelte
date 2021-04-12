<script>
  import { _ } from 'svelte-intl'
  import Group from './Group.svelte'

  export let toolsGroup = new Map()
  export let current = null
</script>

<style type="postcss">
  aside {
    @apply p-4;

    h1 {
      @apply text-2xl;
    }
  }
</style>

<aside>
  <h1>{$_('UI Workbench')}</h1>
  <Group {toolsGroup} {current} on:select />
</aside>
