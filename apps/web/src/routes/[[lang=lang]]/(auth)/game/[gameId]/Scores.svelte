<script>
  // @ts-check
  //import { PlayerThumbnail } from '@src/components'
  import { buildCornerClipPath } from '@src/utils'
  import { fly } from 'svelte/transition'

  /** @type {?import('@tabulous/types').Scores} displayed scores. */
  export let scores = null
  /** @type {Map<string, import('@src/stores').PlayerWithPref>} map of game/lobby players by their ids. */
  export let playerById

  const [cornerId1, corner1] = buildCornerClipPath({ placement: 'left' })
  const [cornerId2, corner2] = buildCornerClipPath({
    placement: 'left',
    inverted: true
  })
</script>

{#if scores}
  <div
    transition:fly={{ x: -200 }}
    style="--corner1: url(#{cornerId1});--corner2: url(#{cornerId2});"
  >
    <span />
    {#each Object.entries(scores) as [playerId, score]}
      {@const player = playerById.get(playerId)}
      <!--<PlayerThumbnail player={playerById.get(playerId)} dimension={40} />-->
      <figure style="--color: {player?.color}" title={player?.username}>
        <figcaption>{score.total}</figcaption>
      </figure>
    {/each}
  </div>
{/if}
<svg style="width:0px; height:0px">
  <clipPath id={cornerId1} clipPathUnits="objectBoundingBox">
    <path {...corner1} />
  </clipPath>
  <clipPath id={cornerId2} clipPathUnits="objectBoundingBox">
    <path {...corner2} />
  </clipPath>
</svg>

<style lang="postcss">
  div {
    @apply absolute left-0 top-1/3 flex flex-col items-center gap-2 px-1.5 cursor-default;
    --corner-overlap: 0.6rem;
    --corner-size: 3.5rem;

    :global(& > *) {
      @apply z-1;
    }

    &::before {
      @apply absolute inset-x-0 bg-$base-darker;
      bottom: calc(100% - var(--corner-overlap) - 1px);
      height: var(--corner-size);
      content: '';
      clip-path: var(--corner1);
    }
    &::after {
      @apply absolute inset-x-0 bg-$base-darker;
      top: calc(100% - var(--corner-overlap) - 1px);
      height: var(--corner-size);
      content: '';
      clip-path: var(--corner2);
    }

    & > span {
      @apply absolute inset-x-0 bg-$base-darker;
      top: var(--corner-overlap);
      bottom: var(--corner-overlap);
    }
  }

  figure {
    @apply grid justify-center items-center rounded-md w-10 text-$ink-dark;
    background-color: var(--color);
  }

  /* figure {
    @apply grid justify-center items-center rounded-full w-10 h-10 text-$ink-dark border-5 bg-$base-darkest;
    border-color: var(--color);
  } */
</style>
