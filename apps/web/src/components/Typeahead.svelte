<script>
  // @ts-check
  import { tick } from 'svelte'

  import Input from './Input.svelte'
  import Menu from './Menu.svelte'

  /** @typedef {(Record<string, ?> & string)|import('@src/components').LabelMenuOption} MenuOption */

  /** @type {MenuOption[]} options displayed in the drop down menu. */
  export let options
  /** @type {?MenuOption} currently active option. */
  export let value = null
  /** @type {?HTMLInputElement} reference to the input text field. */
  export let ref = null
  /** @type {?HTMLSpanElement } reference to the button's wrapper. */
  let anchor
  let open = false
  /** @type {?HTMLUListElement } reference to the menu. */
  let menu
  /** @type {string} text displayed in the field, based on input or selected option. */
  let text

  $: if (value) {
    // updates text based on current option
    text = typeof value === 'string' ? value : value.label
  } else {
    text = ''
  }

  $: if (options) {
    // open menu when setting options
    open = true
  }

  async function handleKeyUp(/** @type {KeyboardEvent} */ evt) {
    if (!open || !menu) {
      return
    }
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      // set menu's direction when looking for focusable
      menu.dataset.focusNext = `${evt.key === 'ArrowDown'}`
      menu.focus()
      evt.preventDefault()
    } else if (evt.key === 'ArrowRight' || evt.key === 'Enter') {
      open = false
      evt.preventDefault()
      if (!value) {
        value = options[0] ?? null
      }
    } else {
      // matches possible option with current text
      const text = /** @type {HTMLInputElement} */ (evt.target).value
      await tick()
      value =
        options?.find(option =>
          typeof option === 'string'
            ? option === text
            : !option.disabled && option.label === text
        ) ?? null
    }
  }
</script>

<span
  class="wrapper"
  bind:this={anchor}
  aria-haspopup="menu"
  aria-expanded={open}
>
  <Input
    {...$$restProps}
    type="text"
    value={text}
    bind:ref
    on:input
    on:keyup
    on:keydown
    on:blur
    on:focus
    on:focus={() => {
      if (options?.length) {
        open = true
      }
    }}
    on:keyup={handleKeyUp}
  />
  <Menu
    {anchor}
    {open}
    {options}
    bind:value
    takesFocus={false}
    bind:ref={menu}
    on:close
    on:select
    on:close={() => (open = false)}
    on:select={({ detail }) => (value = detail)}
  />
</span>

<style lang="postcss">
  .wrapper {
    @apply relative inline-block flex-grow;

    :global(fieldset) {
      @apply mb-0;
    }
  }
</style>
