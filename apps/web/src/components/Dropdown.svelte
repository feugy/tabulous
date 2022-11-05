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
  export let openOnClick = true

  const dispatch = createEventDispatcher()
  let menu
  let anchor

  $: iconOnly = !valueAsText && !text
  $: if (valueAsText) {
    text = value ? value.label || value : text
  }

  function handleSelect({ detail }) {
    if (value !== detail) {
      value = detail
      dispatch('select', value)
    }
  }

  function handleClick() {
    if (openOnClick) {
      handleArrowClick()
    } else {
      dispatch('click')
    }
  }

  function handleArrowClick() {
    open = !open
    if (!open) {
      dispatch('close')
    }
  }
</script>

<span
  class="wrapper"
  bind:this={anchor}
  aria-haspopup="menu"
  aria-expanded={open}
>
  <Button {...$$restProps} {text} on:click={handleClick}>
    <slot name="icon" />
    {#if withArrow && options.length > 1}
      <i
        class:iconOnly
        class="material-icons arrow"
        on:click|stopPropagation={handleArrowClick}
      >
        {`arrow_drop_${open ? 'up' : 'down'}`}
      </i>
    {/if}
  </Button>
  <Menu
    {anchor}
    {open}
    {options}
    {value}
    takesFocus
    bind:ref={menu}
    on:close
    on:close={() => (open = false)}
    on:select={handleSelect}
  />
</span>

<style lang="postcss">
  .wrapper {
    @apply relative inline-block;
  }

  .arrow {
    @apply ml-2 -mr-2;
  }
</style>
