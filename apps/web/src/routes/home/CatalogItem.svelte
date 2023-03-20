<script>
  import { gameAssetsUrl } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  export let game

  const dispatch = createEventDispatcher()
  $: title = game?.locales?.[$locale]?.title
  $: seatsHidden = !game?.maxSeats && !game?.minSeats
  $: timeHidden = !game?.minTime
  $: ageHidden = !game?.minAge
  $: detailsHidden = !game?.copyright

  function formatCopyright(field) {
    return game?.copyright?.[field].map(({ name }) => name).join(', ')
  }

  function formatSeats() {
    return game
      ? game.minSeats === game.maxSeats
        ? game.minSeats
        : `${game.minSeats}-${game.maxSeats}`
      : ''
  }

  function handleClick() {
    dispatch('select', game.name)
  }

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article role="link" tabindex={0} on:click={handleClick} on:keyup={handleKey}>
  <img src="{gameAssetsUrl}/{game.name}/catalog/cover.webp" alt={title} />
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
    <details class:hidden={detailsHidden}>
      <summary on:click|stopPropagation on:keyup|stopPropagation
        ><strong>{$_('labels.game-authors')}</strong>{formatCopyright(
          'authors'
        )}</summary
      >
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
    </details>
  </legend>
</article>

<style lang="postcss">
  article {
    @apply inline-grid h-64 cursor-pointer flex-1 p-1;
    grid-template-areas: 'full';

    &:hover {
      legend {
        @apply opacity-90 text-$ink-dark;

        h3,
        strong {
          @apply text-$secondary-light;
        }
        .material-icons {
          @apply $text-$primary-light;
        }
      }

      img {
        @apply transform-gpu scale-110;
      }
    }
  }

  img {
    @apply max-h-full place-self-center overflow-hidden 
           transition-all duration-$short;
    grid-area: full;
    --shadow-drop: 0.5rem 0.5rem;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--shadow-color)
    );
  }

  legend {
    @apply inline-grid grid-rows-[min-content,1fr] grid-cols-[auto,min-content] gap-4 p-4 -m-2
           opacity-0 bg-$base-darker text-$base-darker overflow-hidden;
    transition: opacity var(--long), color var(--medium) var(--short);
    grid-area: full;

    --corner-cut: 1.5rem;
    clip-path: polygon(
      0 var(--corner-cut),
      var(--corner-cut) 0,
      100% 0,
      100% calc(100% - var(--corner-cut)),
      calc(100% - var(--corner-cut)) 100%,
      0 100%
    );
  }

  h3 {
    @apply mt-1 mx-1 mb-2;
    transition: color var(--medium) var(--short);
  }

  details:not(.hidden) {
    @apply flex flex-col overflow-auto;
    strong {
      @apply font-normal;
      transition: color var(--medium) var(--short);
    }

    p {
      @apply mt-2;
    }
  }

  .characteristics {
    @apply row-span-2 flex flex-col items-center;

    .material-icons {
      @apply mt-2;
      transition: color var(--medium) var(--short);
    }
  }
</style>
