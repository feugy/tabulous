<script>
  // @ts-check
  import Message from './Message.svelte'

  /** @type {?import('@src/stores').Toast} displayed toast message. */
  export let message = null

  /** @type {(import('@src/stores').Toast & { id: string })[]} queue of displayed messages. */
  let messages = []

  $: if (message) {
    const added = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      duration: message.duration || 4,
      ...message
    }
    setTimeout(() => removeMessage(added.id), added.duration * 1000)
    messages = [...messages, added]
    message = null
  }

  function removeMessage(/** @type {string} */ id) {
    const index = messages.findIndex(candidate => candidate.id === id)
    if (index >= 0) {
      messages = [...messages.slice(0, index), ...messages.slice(index + 1)]
    }
  }
</script>

<div>
  {#each messages as { id, ...toast } (id)}
    <Message {toast} on:close={() => removeMessage(id)} />
  {/each}
</div>

<style lang="postcss">
  div {
    @apply flex flex-col items-end fixed z-20 top-12 right-8 min-w-1/3;
  }
</style>
