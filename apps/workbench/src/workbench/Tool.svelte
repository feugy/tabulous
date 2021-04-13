<script>
  import { registerTool, currentTool } from './stores'

  export let name
  let tool

  $: if (name) {
    tool = { name }
    registerTool(tool)
  }
</script>

{#if $currentTool?.name === name}
  <slot />
{/if}
