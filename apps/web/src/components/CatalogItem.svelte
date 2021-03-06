<script>
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  export let game

  $: title = game?.locales?.[$locale]?.title

  const dispatch = createEventDispatcher()

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

  function cancelEvent(event) {
    event.stopImmediatePropagation()
  }
</script>

<article on:click={() => dispatch('click', game)}>
  <img src="games/{game.name}/catalog/cover.webp" alt={title} />
  <div class="content">
    <caption>
      <div class="title">
        <h3>{title}</h3>
        <details class:hidden={!game.copyright} on:click={cancelEvent}>
          <summary
            ><strong>{$_('labels.game-authors')}</strong>{formatCopyright(
              'authors'
            )}</summary
          >
          <p>
            <strong>{$_('labels.game-designers')}</strong>{formatCopyright(
              'designers'
            )}
          </p>
          <p>
            <strong>{$_('labels.game-publishers')}</strong>{formatCopyright(
              'publishers'
            )}
          </p>
        </details>
      </div>
      <span class="characteristics">
        <span class:hidden={!game.maxSeats && !game.minSeats}
          ><span class="material-icons">people</span>{formatSeats()}</span
        >
        <span class:hidden={!game.minTime}
          ><span class="material-icons">access_time</span>{$_(
            'labels.game-min-time',
            game
          )}</span
        >
        <span class:hidden={!game.minAge}
          ><span class="material-icons">person</span>{$_(
            'labels.game-min-age',
            game
          )}</span
        >
      </span>
    </caption>
  </div>
</article>

<style lang="postcss">
  article {
    @apply inline-grid h-64 shadow-md cursor-pointer flex-1 rounded 
           overflow-hidden bg-$base-lighter transition-all duration-$short;
    grid-template-areas: 'full';

    &:hover {
      @apply transform-gpu scale-105;
    }
  }

  img {
    @apply max-h-full place-self-center overflow-hidden;
    grid-area: full;
  }

  .content {
    @apply flex items-end;
    grid-area: full;
  }

  caption {
    @apply flex flex-nowrap w-full gap-4 p-4 
           opacity-80 bg-$primary text-$primary-lightest;
  }

  .title {
    @apply flex-1 text-left;
  }

  h3 {
    @apply text-xl;
  }

  strong {
    @apply italic font-normal;
  }

  .characteristics {
    @apply flex flex-col gap-2;

    & .material-icons {
      @apply mr-2;
    }
  }
</style>
