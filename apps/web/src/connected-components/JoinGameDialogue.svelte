<script>
  import { push } from 'svelte-spa-router'
  import { _ } from 'svelte-intl'
  import { Button, Dialogue, Input, Progress } from '../components'
  import { joinGame } from '../stores'

  export let open = false

  let idValue
  let title = $_('titles.join-game')
  let closable = true
  $: buttonDisabled = !idValue || !idValue.trim().length || !closable

  async function handleJoinGame() {
    closable = false
    const id = idValue.trim()
    try {
      open = false
      push(`/game/${await joinGame(id)}`)
    } finally {
      closable = true
    }
  }
</script>

<Dialogue {closable} {title} {open} on:close on:open>
  {#if closable}
    <Input placeholder={$_('placeholders.game-id')} bind:value={idValue} />
  {:else}
    <span class="text-center">
      <Progress />
    </span>
  {/if}
  <svelte:fragment slot="buttons">
    <Button
      icon="connect_without_contact"
      text={$_('actions.join-game')}
      disabled={buttonDisabled}
      on:click={handleJoinGame}
    />
  </svelte:fragment>
</Dialogue>
