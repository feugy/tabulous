<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'
  import { Subject } from 'rxjs'
  import { debounceTime, map, switchMap } from 'rxjs/operators'
  import { Button, Dialogue, Typeahead } from '../components'
  import { invite, searchPlayers } from '../stores'

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

  function handleClose() {
    open = false
    candidates = undefined
    guestPlayer = undefined
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

<style lang="postcss">
  div {
    @apply flex;
  }
</style>

<Dialogue
  {title}
  {open}
  on:open={() => inputRef?.focus()}
  on:close
  on:close={handleClose}
>
  <div>
    <Typeahead
      placeholder={$_('placeholders.username')}
      options={candidates}
      bind:value={guestPlayer}
      bind:ref={inputRef}
      on:input={findCandidates}
      on:select={() => inputRef?.focus()}
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
