<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import Dialogue from './Dialogue.svelte'

  export let message = ''
  export let okText = $_('actions.ok')

  const dispatch = createEventDispatcher()
  let okButtonRef = null

  $: if (okButtonRef) {
    okButtonRef.focus()
  }
</script>

<Dialogue closable {...$$restProps} on:close>
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
