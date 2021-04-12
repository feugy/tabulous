<script>
  import { _ } from 'svelte-intl'
  import Group from './Group.svelte'

  export let toolsGroup = new Map()
  export let current = null
</script>

<style type="postcss">
  aside {
    @apply py-4 bg-gray-300 w-56 overflow-auto;

    h1 {
      @apply px-4 text-2xl text-center;

      & .material-icons {
        @apply text-yellow-500 text-4xl;
      }
    }
  }
</style>

<aside>
  <h1>
    <span class="material-icons">handyman</span>
    <span>{$_('UI Workbench')}</span>
  </h1>
  <Group {toolsGroup} {current} on:select />
</aside>
