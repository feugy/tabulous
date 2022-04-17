<script>
  export let items = []
</script>

<style lang="postcss">
  .indicator {
    @apply absolute transform-gpu -translate-y-1/2 -translate-x-1/2
            pointer-events-none 
            font-bold text-lg text-$primary-lightest
            bg-$primary
            py-1 pr-2 pl-5 rounded;
    clip-path: polygon(1rem 0%, 100% 0, 100% 100%, 1rem 100%, 0% 50%);
  }

  .player {
    @apply p-2 pt-1 pb-3 rounded-none;
    --offset: 85%;
    clip-path: polygon(
      0% 0%,
      100% 0%,
      100% var(--offset),
      65% var(--offset),
      50% 100%,
      35% var(--offset),
      0% var(--offset)
    );
  }
</style>

{#each items as { screenPosition: { x, y }, size, username, id } (id)}
  <div
    class="indicator {username ? 'player' : ''}"
    style="top: {y}px; left: {x}px"
  >
    {username ?? size}
  </div>
{/each}
