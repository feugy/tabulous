<script>
  import { _ } from 'svelte-intl'
  import { Button, Dialogue, Input } from '../components'
  import { invite } from '../stores'

  export let gameId

  let input
  let open = false
  let title = $_('titles.invite')
  $: buttonDisabled = !input || !input.trim().length

  function handleClose() {
    input = ''
    open = false
  }

  async function handleInvite() {
    if (buttonDisabled) {
      return
    }
    const playerId = input.trim()
    invite(gameId, playerId)
    handleClose()
  }
</script>

<Button
  secondary
  title={$_('tooltips.invite-player')}
  icon="connect_without_contact"
  on:click={() => (open = true)}
/>
<Dialogue {title} {open} on:close={handleClose}>
  <Input
    placeholder={$_('placeholders.player-id')}
    bind:value={input}
    on:enter={handleInvite}
  />
  <svelte:fragment slot="buttons">
    <Button
      icon="connect_without_contact"
      text={$_('actions.invite')}
      disabled={buttonDisabled}
      on:click={handleInvite}
    />
  </svelte:fragment>
</Dialogue>
