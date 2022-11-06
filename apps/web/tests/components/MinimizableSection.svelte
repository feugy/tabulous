<script>
  import { Discussion, MinimizableSection } from '../../src/components'
  import { players, thread } from './Discussion.testdata'

  export let placement = 'top'
  let currentTab
  const playerById = new Map(players.map(player => [player.id, player]))
</script>

<aside class={placement}>
  <MinimizableSection
    {...$$props}
    bind:currentTab
    on:minimize
    on:resize
    on:change
  >
    {#if !currentTab}
      <Discussion {playerById} {thread} />
    {/if}
    {#if currentTab === 1}
      <span class="p-4">
        <div>
          Vous savez quelle différence il y a entre un con et un voleur ?
        </div>
        <div>Non...</div>
        <div>Un voleur de temps en temps ça se repose.</div></span
      >
    {/if}
  </MinimizableSection>
</aside>

<style lang="postcss">
  aside {
    @apply absolute bg-gray-100;

    &.left {
      @apply left-0;
    }
    &.top {
      @apply top-0;
    }
    &.right {
      @apply right-0;
    }
    &.bottom {
      @apply bottom-0;
    }
    &.left,
    &.right {
      @apply top-0 bottom-0;
      max-width: 50%;
    }
    &.top,
    &.bottom {
      @apply right-0 left-0;
    }
  }
</style>
