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
    text =
      value && !value.color && options?.includes(value)
        ? value.label || value
        : null
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

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleArrowClick()
    }
  }
</script>

<span class="wrapper" bind:this={anchor}>
  <Button
    {...$$restProps}
    role="combobox"
    aria-haspopup="menu"
    aria-expanded={open}
    on:click={handleClick}
  >
    <slot name="icon" />
    <span
      slot="text"
      style:--color={value?.color}
      class:color={Boolean(value?.color)}>{text || ''}</span
    >
    {#if withArrow && options.length > 1}
      <i
        role="button"
        tabindex={openOnClick ? -1 : 0}
        class:iconOnly
        class="material-icons arrow"
        class:split={!openOnClick}
        on:click|stopPropagation|preventDefault={handleArrowClick}
        on:keyup|stopPropagation|preventDefault={handleKey}
      >
        {`arrow_drop_${open ? 'up' : 'down'}`}
      </i>
    {/if}
  </Button>
  <Menu
    {anchor}
    {open}
    {options}
    takesFocus
    bind:value
    bind:ref={menu}
    on:close
    on:select
    on:close={() => (open = false)}
  />
</span>

<style lang="postcss">
  .wrapper {
    @apply relative inline-block h-min;
  }

  .color {
    @apply inline-block w-6 h-6 p-1;
    background-color: var(--color);
  }

  .arrow {
    @apply ml-2 -mr-2;

    &.split {
      @apply border border-$ink border-t-transparent border-r-transparent border-b-transparent ml-4;
    }
  }
</style>
