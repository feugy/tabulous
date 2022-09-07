<script>
  export let steps = []
  const lastRank = steps?.length - 1
</script>

{#if steps?.length > 0}
  <ol>
    {#each steps as { href, label }, rank}
      <li><a href={rank === lastRank ? null : href}>{label}</a></li>
      {#if rank !== lastRank}
        <li>></li>
      {/if}
    {/each}
  </ol>
{/if}

<style lang="postcss">
  ol {
    @apply flex gap-2 text-sm text-$primary;
  }
  li {
    @apply inline-block;
    &:last-child {
      @apply text-$ink;
    }
  }
</style>
