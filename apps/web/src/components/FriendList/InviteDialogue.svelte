<script>
  import { invite } from '@src/stores'
  import { isLobby } from '@src/utils'
  import { _ } from 'svelte-intl'

  import { Button, Dialogue, PlayerThumbnail } from '..'

  /** @type {boolean} */
  export let open
  export let game
  export let friends

  let selected = []
  let listRef

  $: if (open && listRef?.children.length) {
    listRef.children[0].focus({ focusVisible: true })
  }

  function handleToggle(player) {
    const index = selected.indexOf(player)
    if (index >= 0) {
      selected = [...selected.slice(0, index), ...selected.slice(index + 1)]
    } else {
      selected = [...selected, player]
    }
  }

  function handleKeyDown(evt, player) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      handleToggle(player)
    }
  }

  function handleInvite() {
    open = false
    invite(game.id, ...selected.map(({ id }) => id))
    selected = []
  }
</script>

<Dialogue
  closable
  title={$_(isLobby(game) ? 'titles.invite-attendee' : 'titles.invite-player')}
  {open}
  on:close
>
  <ol role="listbox" bind:this={listRef}>
    {#each friends as { player, isRequest, isProposal } (player.id)}
      {#if !isRequest}
        <li
          role="option"
          aria-checked={selected.indexOf(player) >= 0}
          aria-selected={true}
          tabindex={0}
          on:click={() => handleToggle(player)}
          on:keydown={evt => handleKeyDown(evt, player)}
        >
          <PlayerThumbnail {player} dimension={40} />
          <span role="term">{player.username}</span>
        </li>
      {/if}
    {/each}
  </ol>
  <svelte:fragment slot="buttons">
    <Button text={$_('actions.back')} on:click={() => (open = false)} />
    <Button
      primary
      disabled={selected.length === 0}
      text={$_('actions.invite')}
      on:click={handleInvite}
    />
  </svelte:fragment>
</Dialogue>

<style lang="postcss">
  ol {
    @apply my-2 flex-1 overflow-auto;
  }

  li {
    @apply flex items-center p-2 pr-4 gap-2 relative transition-colors duration-$medium rounded cursor-pointer;
    margin: 1px; /* without, outline is not visible */

    &:hover {
      @apply text-$ink-dark bg-$base-darker;
    }

    &[aria-checked='true'] {
      @apply bg-$primary-dark text-$ink-dark;
    }
  }
</style>
