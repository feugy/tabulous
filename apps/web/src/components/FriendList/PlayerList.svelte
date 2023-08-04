<script>
  // @ts-check
  /**
   * @typedef {import('@src/graphql').GameOrGameParameters} GameOrGameParameters
   * @typedef {import('@src/graphql').LightPlayer} Player
   */

  import { kick } from '@src/stores'
  import { isLobby } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import { Button, PlayerThumbnail } from '..'

  /** @type {({ player: Player, isNotFriend: boolean })[]} list of game/lobby active players. */
  export let players
  /** @type {GameOrGameParameters} game data. */
  export let game

  const dispatch = createEventDispatcher()

  function canBeKicked(/** @type {Player} */ player) {
    return game && !player.isOwner && (player.isGuest || isLobby(game))
  }
</script>

<ol>
  {#each players as { player, isNotFriend } (player.id)}
    <li class:isNotFriend>
      <PlayerThumbnail {player} dimension={40} />
      <span role="term"
        >{player.username}{#if player.isGuest}<span class="guest"
            >{$_('labels.guest')}</span
          >{/if}</span
      >
      <span class="buttons">
        {#if canBeKicked(player)}
          <Button
            icon="highlight_remove"
            on:click={() => kick(game.id, player.id)}
          />
        {/if}
        {#if isNotFriend}
          <Button
            icon="person_add_alt_1"
            on:click={() => dispatch('makeFriend', player)}
          />
        {/if}
      </span>
    </li>
  {/each}
</ol>

<style lang="postcss">
  ol {
    @apply my-2 flex-1 overflow-auto;
  }

  li {
    @apply flex items-center p-2 pr-4 gap-2 relative transition-colors duration-$medium rounded;

    &:hover {
      @apply text-$ink-dark bg-$base-darker;
      & .buttons {
        @apply opacity-100;
      }
      .guest {
        @apply text-$primary-lighter;
      }
    }

    &.isNotFriend {
      @apply text-$secondary-darker;
    }
  }

  .buttons {
    @apply flex flex-nowrap gap-2 justify-self-end opacity-0 absolute right-4 transition-opacity duration-$long;
  }

  .guest {
    @apply transition-colors duration-$medium ml-2 before:content-['('] after:content-[')'] text-$primary-darker;
  }
</style>
