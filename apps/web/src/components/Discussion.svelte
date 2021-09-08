<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'
  import Input from './Input.svelte'

  export let thread
  export let players

  const dispatch = createEventDispatcher()
  let text = ''
  let messageContainer
  const playerById = new Map()

  $: if (messageContainer && thread) {
    // automatically scrolls to last when receiving a new message
    setTimeout(() => {
      messageContainer?.lastElementChild?.scrollIntoView()
    }, 0)
  }

  $: {
    playerById.clear()
    for (const player of players ?? []) {
      playerById.set(player.id, player)
    }
  }

  function handleSend() {
    dispatch('sendMessage', { text })
    text = ''
  }
</script>

<style type="postcss">
  .discussion {
    @apply flex flex-col overflow-auto p-2 shadow-md justify-end h-full;
    background: theme('backgrounds.primary');
  }

  .messages {
    @apply grid overflow-y-auto;
    grid-template-columns: minmax(auto, 22.5%) 1fr;

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
  <div class="messages" bind:this={messageContainer}>
    {#each thread || [] as { playerId, text }}
      <span class="from">{playerById.get(playerId)?.username ?? ''}</span><span
        class="message">{text}</span
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
  </form>
</div>
