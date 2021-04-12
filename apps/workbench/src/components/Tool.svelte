<script>
  import { registerTool, currentTool } from '../stores/workbench'

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
