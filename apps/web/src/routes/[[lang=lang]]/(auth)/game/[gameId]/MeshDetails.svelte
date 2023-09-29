<script>
  // @ts-check
  import { gameAssetsUrl, injectLocale } from '@src/utils'
  import { tick } from 'svelte'
  import { locale } from 'svelte-intl'

  /** @type {?import('@src/3d/managers').MeshDetails} displayed mesh(es). */
  export let details = null

  /** @type {?HTMLDivElement} */
  let container = null
  let style = ''

  $: if (details?.position) {
    updateStyle()
  }

  let loop = 1
  async function updateStyle() {
    if (loop < 10 && (container?.offsetWidth ?? 0) === 0) {
      loop++
      await tick()
      updateStyle()
      return
    }
    loop = 1
    style = `--width:${container?.offsetWidth}px; --left:${details?.position.x}px; --top:${details?.position.y}px`
  }
</script>

<div
  bind:this={container}
  class:open={(details?.images?.length ?? 0) > 0}
  {style}
>
  {#each details?.images ?? [] as image}
    <img src="{gameAssetsUrl}{injectLocale(image, 'images', $locale)}" alt="" />
  {/each}
</div>

<style lang="postcss">
  div {
    @apply flex flex-wrap gap-4 absolute z-10 pointer-events-none;
    --padding: 20px;
    --imageWidth: 50vw;
    --imageHeight: 50vh;
    max-width: calc(100vw - var(--padding) * 2);
    top: calc(
      min(
        max(var(--top), var(--padding)),
        100vh - var(--imageHeight) - var(--padding)
      )
    );
    left: calc(
      min(
        max(var(--left), var(--padding)),
        100vw - var(--width) - var(--padding)
      )
    );

    & > img {
      @apply w-auto h-auto;
      max-width: var(--imageWidth);
      max-height: var(--imageHeight);
      filter: drop-shadow(0 0 20px var(--shadow-dark));
    }
  }
</style>
