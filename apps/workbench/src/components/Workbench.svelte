<script>
  export let tools = []
</script>

{#each tools as tool}
  <svelte:component this={tool} />
{/each}
