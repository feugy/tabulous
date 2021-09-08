<script>
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'
  import Menu from './Menu.svelte'

  export let options
  export let value = null
  export let valueAsText = true
  export let withArrow = true
  export let text = null
  export let open = false

  const dispatch = createEventDispatcher()
  let menu
  let anchor

  $: iconOnly = !valueAsText && !text
  $: if (valueAsText) {
    text = value ? value.label || value : text
  }

  function handleClick() {
    open = !open
    if (!open) {
      dispatch('close')
    }
  }
</script>

<style type="postcss">
  .wrapper {
    @apply relative inline-block;
  }

  .arrow {
    @apply ml-2 -mr-2;
  }
</style>

<span
  class="wrapper"
  bind:this={anchor}
  aria-haspopup="menu"
  aria-expanded={open}
>
  <Button {...$$restProps} {text} on:click={handleClick}>
    {#if withArrow}
      <i class:iconOnly class="material-icons arrow">
        {`arrow_drop_${open ? 'up' : 'down'}`}
      </i>
    {/if}
  </Button>
  <Menu
    {anchor}
    {open}
    {options}
    bind:value
    takesFocus
    bind:ref={menu}
    on:close
    on:select
    on:close={() => (open = false)}
    on:select={({ detail }) => (value = detail)}
  />
</span>
