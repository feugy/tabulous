<script>
  // @ts-check

  /** @type {{ href?: ?string, label: string }[]} list of breadcrumb elements, with a friendly label and possibly a link (all but last one ) */
  export let steps = []

  const lastRank = steps?.length - 1
</script>

<div>
  {#if steps?.length > 0}
    <span class="material-icons">home_filled</span>
    <ol>
      {#each steps as { href, label }, rank}
        <li><a href={rank === lastRank ? null : href}>{label}</a></li>
        {#if rank !== lastRank}
          <li>•</li>
        {/if}
      {/each}
    </ol>
  {/if}
</div>

<style lang="postcss">
  ol {
    @apply inline-flex gap-2 text-sm;
  }
  li {
    @apply inline-block;

    &:last-child a {
      @apply text-$ink;
    }
  }
</style>
