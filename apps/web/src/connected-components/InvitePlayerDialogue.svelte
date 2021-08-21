<script>
  import { _ } from 'svelte-intl'
  import { Button, Dialogue, Input } from '../components'
  import { invite } from '../stores'

  export let gameId
  export let open = false

  let inputRef
  let text
  let title = $_('titles.invite')

  $: disabled = !text || !text.trim().length

  $: if (open && inputRef) {
    // we must wait for the dialogue to be displayed
    setTimeout(() => inputRef.focus(), 100)
  }

  function handleClose() {
    text = ''
    open = false
  }

  async function handleInvite() {
    if (disabled) {
      return
    }
    const playerId = text.trim()
    invite(gameId, playerId)
    handleClose()
  }
</script>

<Dialogue {title} {open} on:close on:close={handleClose}>
  <Input
    placeholder={$_('placeholders.player-id')}
    bind:value={text}
    bind:ref={inputRef}
    on:enter={handleInvite}
  />
  <svelte:fragment slot="buttons">
    <Button
      icon="connect_without_contact"
      text={$_('actions.invite')}
      {disabled}
      on:click={handleInvite}
    />
  </svelte:fragment>
</Dialogue>
