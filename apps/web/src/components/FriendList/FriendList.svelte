<script>
  // @ts-check
  /**
   * @typedef {import('@src/graphql').Friendship} Friendship
   * @typedef {import('@src/graphql').PlayerFragment} PlayerFragment
   */

  import { acceptFriendship, endFriendship } from '@src/stores'
  import { _ } from 'svelte-intl'

  import { Button, ConfirmDialogue, PlayerThumbnail } from '..'

  /** @type {Friendship[]} list of displayed friendships. */
  export let friends = []

  /** @type {?PlayerFragment}*/
  let friendToRemove = null

  function handleEndingFriendship(
    /** @type {CustomEvent<boolean>} */ { detail: isConfirmed }
  ) {
    if (isConfirmed && friendToRemove) {
      endFriendship(friendToRemove)
    }
    friendToRemove = null
  }
</script>

<ol role="listbox">
  {#each friends as { player, isRequest, isProposal } (player.id)}
    <li class:isRequest class:isProposal>
      <PlayerThumbnail {player} dimension={40} />
      <span role="term"
        >{isProposal
          ? $_('labels.friendship-proposed', player)
          : isRequest
          ? $_('labels.friendship-requested', player)
          : player.username}</span
      >
      <span class="buttons">
        {#if isRequest}
          <Button
            icon="check"
            primary
            on:click={() => acceptFriendship(player)}
          />
          <Button icon="clear" on:click={() => endFriendship(player)} />
        {:else}
          <Button icon="delete" on:click={() => (friendToRemove = player)} />
        {/if}
      </span>
    </li>
  {/each}
</ol>
{#if friendToRemove}
  <ConfirmDialogue
    title={$_('titles.end-friendship')}
    open={true}
    message={$_('labels.end-friendship', friendToRemove)}
    on:close={handleEndingFriendship}
  />
{/if}

<style lang="postcss">
  ol {
    @apply my-2 flex-1 overflow-auto;
  }

  li {
    @apply flex items-center p-2 pr-4 gap-2 relative transition-colors duration-$medium rounded;

    &:hover,
    &:hover.isProposal,
    &:hover.isRequest {
      @apply text-$ink-dark bg-$base-darker;
      & .buttons {
        @apply opacity-100;
      }
    }

    &.isRequest,
    &.isProposal {
      @apply text-$primary-darker;
    }
  }

  .buttons {
    @apply flex flex-nowrap gap-2 justify-self-end opacity-0 absolute right-4 transition-opacity duration-$long;
  }
</style>
