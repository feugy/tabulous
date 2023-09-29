<script>
  // @ts-check
  import { createEventDispatcher } from 'svelte'

  import Button from './Button.svelte'
  import Menu from './Menu.svelte'

  /** @type {import('@src/components').MenuOption[]} options displayed in the drop down menu. */
  export let options
  /** @type {?import('@src/components').MenuOption} currently active option. */
  export let value = null
  /** @type {boolean} whether to use the active option as button text, or fixed text. */
  export let valueAsText = true
  /** @type {boolean} whether to display a drop down arrow in the button. */
  export let withArrow = true
  /** @type {?string} fixed button text, unless using `valueAsText`. */
  export let text = null
  /** @type {boolean} whether the drop down menu is open. */
  export let open = false
  /** @type {boolean} whether the drop down menu should open when clicking on the button. */
  export let openOnClick = true

  /** @type {import('svelte').EventDispatcher<{ click: void, select: ?import('@src/components').MenuOption, close: void }>} */
  const dispatch = createEventDispatcher()
  /** @type {?HTMLUListElement } reference to the menu. */
  let menu
  /** @type {?HTMLSpanElement } reference to the button's wrapper. */
  let anchor

  $: iconOnly = !valueAsText && !text
  $: optionColor =
    value && typeof value === 'object' && 'color' in value ? value.color : null
  $: if (valueAsText) {
    text =
      !value || optionColor
        ? ' '
        : options?.includes(value)
        ? typeof value === 'object' && 'Component' in value
          ? null
          : typeof value === 'string'
          ? value
          : value.label
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

  function handleKey(/** @type {KeyboardEvent} */ event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleArrowClick()
    }
  }
</script>

<span class="wrapper" bind:this={anchor}>
  <Button
    {...$$restProps}
    {text}
    role="combobox"
    aria-haspopup="menu"
    aria-expanded={open}
    on:click={handleClick}
  >
    <slot name="icon" />
    <span
      slot="text"
      style:--color={optionColor}
      class:color={Boolean(optionColor)}>{text || ''}</span
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
    @apply inline-block w-6 h-[1.35rem];
    background-color: var(--color);
  }

  .arrow {
    @apply ml-2 -mr-2;

    &.split {
      @apply border border-$ink border-t-transparent border-r-transparent border-b-transparent ml-4;
    }
  }
</style>
