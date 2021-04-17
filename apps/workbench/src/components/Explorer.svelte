<script>
  import { _ } from 'svelte-intl'
  import Group from './Group.svelte'

  export let toolsGroup = new Map()
  export let current = null
</script>

<style type="postcss">
  aside {
    @apply py-4 w-56 overflow-auto border-r flex-shrink-0;
    border-color: theme('colors.primary.main');
    h1 {
      @apply px-4 text-2xl text-center;

      & .material-icons {
        @apply text-4xl;
        color: theme('colors.primary.main');
      }
    }
  }
</style>

<aside>
  <h1>
    <span class="material-icons">handyman</span>
    <span>{$_('title.app')}</span>
  </h1>
  <slot />
  <Group {toolsGroup} {current} on:select />
</aside>
