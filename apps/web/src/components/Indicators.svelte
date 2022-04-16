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
</style>

{#each items as { screenPosition: { x, y }, size, name, id } (id)}
  <div class="indicator" style="top: {y}px; left: {x}px">
    {name ?? size}
  </div>
{/each}
