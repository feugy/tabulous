<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import Dialogue from './Dialogue.svelte'

  export let open
  export let message = ''
  export let cancelText = $_('actions.cancel')
  export let confirmText = $_('actions.confirm')

  const dispatch = createEventDispatcher()
  let confirmed = null
  let cancelButtonRef = null

  $: if (cancelButtonRef) {
    cancelButtonRef.focus()
  }

  function handleClose(event) {
    event.stopImmediatePropagation()
    dispatch('close', confirmed ?? false)
    confirmed = null
    open = false
  }
</script>

<Dialogue closable {open} {...$$restProps} on:close={handleClose}>
  {message}
  <slot />
  <svelte:fragment slot="buttons">
    <Button
      secondary
      text={cancelText}
      bind:ref={cancelButtonRef}
      on:click={() => (open = false)}
    />
    <Button
      text={confirmText}
      on:click={() => {
        confirmed = true
        open = false
      }}
    />
  </svelte:fragment>
</Dialogue>
