<script>
  // @ts-check
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import Dialogue from './Dialogue.svelte'

  /** @type {string} displayed information message. */
  export let message = ''
  /** @type {string} text displayed on the single button. */
  export let okText = $_('actions.ok')

  /** @type {import('svelte').EventDispatcher<{ close: void }>} */
  const dispatch = createEventDispatcher()
  /** @type {?HTMLButtonElement} */
  let okButtonRef = null
  let restProps = /** @type {{ title: string, open: boolean }} */ ($$restProps)

  $: if (okButtonRef) {
    okButtonRef.focus()
  }
</script>

<Dialogue closable {...restProps} on:close>
  {message}
  <slot />
  <svelte:fragment slot="buttons">
    <Button
      text={okText}
      bind:ref={okButtonRef}
      on:click={() => dispatch('close')}
    />
  </svelte:fragment>
</Dialogue>
