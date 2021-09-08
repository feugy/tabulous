<script>
  import { _ } from 'svelte-intl'
  import { debounceTime, map, switchMap } from 'rxjs/operators'
  import { Button, Dialogue, Typeahead } from '../components'
  import { invite, searchPlayers } from '../stores'
  import { Subject } from 'rxjs'
  import { onMount } from 'svelte'

  export let game
  export let open = false

  let inputRef
  let title = $_('titles.invite')
  let candidates
  let guestPlayer
  let search = new Subject()

  onMount(() =>
    search
      .pipe(
        debounceTime(100),
        switchMap(search => searchPlayers(search)),
        map(players =>
          players.map(player => ({
            ...player,
            disabled: Boolean(game.players.find(({ id }) => id === player.id)),
            label: player.username
          }))
        )
      )
      .subscribe({ next: results => (candidates = results) })
  )

  $: if (open && inputRef) {
    // we must wait for the dialogue to be displayed
    setTimeout(() => inputRef?.focus(), 100)
  }

  function handleClose() {
    open = false
    guestPlayer = null
  }

  async function handleInvite() {
    if (!guestPlayer) {
      return
    }
    if (await invite(game.id, guestPlayer.id)) {
      handleClose()
    }
  }

  async function findCandidates({ target }) {
    const text = target?.value ?? ''
    if (text.length >= 2) {
      search.next(text)
    } else {
      candidates = undefined
      guestPlayer = undefined
    }
  }
</script>

<style type="postcss">
  div {
    @apply flex;
  }
</style>

<Dialogue {title} {open} on:close on:close={handleClose}>
  <div>
    <Typeahead
      placeholder={$_('placeholders.username')}
      bind:ref={inputRef}
      options={candidates}
      on:input={findCandidates}
      on:select={({ detail }) => (guestPlayer = detail)}
    />
  </div>
  <svelte:fragment slot="buttons">
    <Button
      icon="connect_without_contact"
      text={$_('actions.invite')}
      disabled={!guestPlayer}
      on:click={handleInvite}
    />
  </svelte:fragment>
</Dialogue>
