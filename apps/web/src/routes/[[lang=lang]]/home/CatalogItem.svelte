<script>
  // @ts-check
  import { gameAssetsUrl } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  /** @type {import('@src/graphql').CatalogItem} displayed catalog item. */
  export let game

  /** @type {import('svelte').EventDispatcher<{ select: import('@src/graphql').CatalogItem & { title: string } }>}*/
  const dispatch = createEventDispatcher()
  $: title = game?.locales?.[$locale]?.title
  $: seatsHidden = !game?.maxSeats && !game?.minSeats
  $: timeHidden = !game?.minTime
  $: ageHidden = !game?.minAge

  function formatCopyright(/** @type {string} */ field) {
    return /** @type {Record<string, { name: string }[]>} */ (
      game?.copyright
    )?.[field]
      .map(({ name }) => name)
      .join(', ')
  }

  function formatSeats() {
    return game
      ? game.minSeats === game.maxSeats
        ? game.minSeats
        : `${game.minSeats}-${game.maxSeats}`
      : ''
  }

  function handleClick() {
    dispatch('select', { ...game, title })
  }
</script>

<button tabindex={0} on:click={handleClick}>
  <img
    src="{gameAssetsUrl}/{game.name}/catalog/{$locale}/cover.webp"
    alt={title}
  />
  <legend>
    <h3>{title}</h3>
    <div class="characteristics">
      <i class="material-icons" class:hidden={seatsHidden}>people</i><span
        class:hidden={seatsHidden}>{formatSeats()}</span
      >
      <i class="material-icons" class:hidden={timeHidden}>access_time</i><span
        class:hidden={timeHidden}>{$_('labels.game-min-time', game)}</span
      >
      <i class="material-icons" class:hidden={ageHidden}>person</i><span
        class:hidden={ageHidden}>{$_('labels.game-min-age', game)}</span
      >
    </div>
    <div class="details">
      {#if game?.copyright?.authors}
        <p>
          <strong>{$_('labels.game-authors')}</strong>{formatCopyright(
            'authors'
          )}
        </p>
      {/if}
      {#if game?.copyright?.designers}
        <p>
          <strong>{$_('labels.game-designers')}</strong>{formatCopyright(
            'designers'
          )}
        </p>
      {/if}
      {#if game?.copyright?.publishers}
        <p>
          <strong>{$_('labels.game-publishers')}</strong>{formatCopyright(
            'publishers'
          )}
        </p>
      {/if}
    </div>
  </legend>
</button>

<style lang="postcss">
  button {
    @apply relative inline-flex flex-col justify-center items-stretch h-64 flex-1 text-left rounded;
    background: var(--card-light) var(--base-lighter);
    transition:
      transform var(--short),
      box-shadow var(--short),
      background-position var(--long);
    box-shadow: 0px 3px 10px var(--shadow-color);

    &:hover {
      transform: perspective(450px) rotate3d(1, 0, 0, 5deg)
        scale3d(1.05, 1.05, 1.05) translate3d(0, -4px, 0);
      background-position: 0 0;
      box-shadow: 0px 1rem 10px var(--shadow-color);

      img {
        @apply max-h-1/3 -m-b-3;
      }

      legend {
        @apply h-1/1 opacity-100 text-$ink-dark;
      }

      .details {
        @apply opacity-100;
      }
    }
  }

  img {
    @apply max-h-full place-self-center overflow-hidden z-10 transition-all;
    --shadow-drop: 0.5rem 0.5rem;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--shadow-color)
    );
  }

  legend {
    @apply inline-grid grid-rows-[min-content,1fr] grid-cols-[auto,min-content] gap-1 p-4 -m-2
           h-0 opacity-0 bg-$base-darker text-$ink-dark overflow-hidden z-1 rounded;
    transition:
      opacity var(--long) var(--medium),
      height var(--long);
  }

  h3 {
    @apply m-1 text-$primary-light;
  }

  .details {
    @apply flex flex-col overflow-auto m-l-1 opacity-0;
    transition: opacity var(--short) var(--long);

    strong {
      @apply font-normal text-$secondary;
    }

    p {
      @apply mt-2;
    }
  }

  .characteristics {
    @apply row-span-2 flex flex-col items-center;

    .material-icons {
      @apply mt-2 text-$base-light;
    }
  }
</style>
