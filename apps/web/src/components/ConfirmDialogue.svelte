<script>
  // @ts-check
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import Dialogue from './Dialogue.svelte'

  /** @type {boolean} whether this dialogur is open. */
  export let open
  /** @type {string} dialogue main title. */
  export let title
  /** @type {?} dialogue message (could be any content). */
  export let message = ''
  /** @type {string} text of the cancellation button (default to 'actions.cancel'). */
  export let cancelText = $_('actions.cancel')
  /** @type {string} text of the confirmation button (default to 'actions.confirm'). */
  export let confirmText = $_('actions.confirm')

  /** @type {import('svelte').EventDispatcher<{ close: boolean }>}*/
  const dispatch = createEventDispatcher()
  /** @type {?boolean} */
  let confirmed = null
  /** @type {?HTMLButtonElement} */
  let cancelButtonRef = null

  $: if (cancelButtonRef) {
    cancelButtonRef.focus()
  }

  function handleClose(
    /** @type {import('svelte').ComponentEvents<Dialogue>['close']} */ event
  ) {
    event.stopImmediatePropagation()
    dispatch('close', confirmed ?? false)
    confirmed = null
    open = false
  }
</script>

<Dialogue closable {open} {title} on:close={handleClose}>
  {message}
  <slot />
  <svelte:fragment slot="buttons">
    <Button
      text={cancelText}
      bind:ref={cancelButtonRef}
      on:click={() => (open = false)}
    />
    <Button
      primary
      text={confirmText}
      on:click={() => {
        confirmed = true
        open = false
      }}
    />
  </svelte:fragment>
</Dialogue>
