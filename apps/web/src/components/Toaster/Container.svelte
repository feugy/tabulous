<script>
  import Message from './Message.svelte'
  export let message = null

  let messages = []

  $: if (message) {
    const added = {
      ...message,
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      duration: message.duration || 4,
      ...message
    }
    added.timeout = setTimeout(
      () => removeMessage(added.id),
      added.duration * 1000
    )
    messages = [...messages, added]
    message = null
  }

  function removeMessage(id) {
    const index = messages.findIndex(candidate => candidate.id === id)
    if (index >= 0) {
      messages = [...messages.slice(0, index), ...messages.slice(index + 1)]
    }
  }
</script>

<div>
  {#each messages as { timeout, id, ...message } (id)}
    <Message {...message} on:close={() => removeMessage(id)} />
  {/each}
</div>

<style lang="postcss">
  div {
    @apply relative flex flex-col items-end fixed z-20 top-12 right-8;
  }
</style>
