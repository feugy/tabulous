<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'
  import Dialogue from './Dialogue.svelte'

  export let open
  export let message

  let confirmed = null
  let cancelButtonRef = null
  const dispatch = createEventDispatcher()

  $: if (cancelButtonRef) {
    cancelButtonRef.focus()
  }

  function handleClose(event) {
    event.stopImmediatePropagation()
    dispatch('close', confirmed ?? false)
    confirmed = null
  }
</script>

<Dialogue closable {open} {...$$restProps} on:close={handleClose}>
  {message}
  <slot />
  <svelte:fragment slot="buttons">
    <Button
      secondary
      text={$_('actions.cancel')}
      bind:ref={cancelButtonRef}
      on:click={() => (open = false)}
    />
    <Button
      text={$_('actions.confirm')}
      on:click={() => {
        confirmed = true
        open = false
      }}
    />
  </svelte:fragment>
</Dialogue>
