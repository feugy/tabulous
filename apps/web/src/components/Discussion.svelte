<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import { Button, Input } from '.'

  export let thread

  const dispatch = createEventDispatcher()
  let text = ''

  function handleSend() {
    dispatch('sendMessage', { text })
    text = ''
  }
  function handleInvite(event) {
    dispatch('askInvite')
    // to avoid submitting the whole form
    event.preventDefault()
  }
</script>

<style type="postcss">
  .discussion {
    @apply flex flex-col p-4;
  }
  .messages {
    @apply grid flex-grow overflow-y-auto;
    grid-template-columns: auto 1fr;

    & > * {
      @apply pb-2;
    }
  }
  .from {
    @apply text-right font-medium pr-2;
    color: theme('colors.secondary.main');
  }
  form {
    @apply flex gap-4 items-center;
  }
</style>

<div class="discussion">
  <div class="messages">
    {#each thread || [] as { from, message }}
      <span class="from">{from?.username}</span><span class="message"
        >{message}</span
      >
    {/each}
  </div>
  <form on:submit|preventDefault={handleSend}>
    <Input bind:value={text} />
    <Button
      type="submit"
      disabled={text?.trim().length === 0}
      title={$_('tooltips.send-message')}
      icon="send"
    />
    <Button
      secondary
      title={$_('tooltips.invite-player')}
      icon="connect_without_contact"
      on:click={handleInvite}
    />
  </form>
</div>
