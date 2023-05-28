<script>
  import { tick } from 'svelte'

  import Input from './Input.svelte'
  import Menu from './Menu.svelte'

  export let value = null
  export let options
  export let ref = null
  let anchor
  let open
  let menu
  let text

  $: if (value) {
    // updates text based on current option
    text = value?.label ?? value
  } else {
    text = ''
  }

  $: if (options) {
    // open menu when setting options
    open = true
  }

  async function handleKeyUp(evt) {
    if (!open || !menu) {
      return
    }
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      // set menu's direction when looking for focusable
      menu.dataset.focusNext = evt.key === 'ArrowDown'
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
      const text = evt.currentTarget.value
      await tick()
      value = options?.find(
        option =>
          option?.label === text || (option === text && !option?.disabled)
      )
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
  }
</style>
