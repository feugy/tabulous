<script>
  import { createEventDispatcher } from 'svelte'
  import { slide } from 'svelte/transition'
  import Portal from 'svelte-portal'

  export let anchor
  export let options
  export let open
  export let value = null
  export let takesFocus = true
  export let ref = null

  const dispatch = createEventDispatcher()

  $: if (open) {
    handleVisible()
  }

  function isInComponent(element) {
    return !element
      ? false
      : element === ref ||
        element.getAttribute?.('role') === 'menu' ||
        element === anchor
      ? true
      : isInComponent(element.parentElement)
  }

  function select(option) {
    value = option
    dispatch('select', value)
    toggleVisibility()
  }

  function toggleVisibility() {
    open = !open
    if (!open) {
      dispatch('close')
    }
  }

  function handleInteraction(evt) {
    if ((evt.target && isInComponent(evt.target)) || !open) {
      return
    }
    toggleVisibility()
  }

  async function handleVisible() {
    if (!ref || !anchor) {
      return
    }
    const sav = ref.getAttribute('style')
    // reset styling to get final menu dimension
    ref.setAttribute('style', '')
    const anchorDim = anchor.getBoundingClientRect()
    const { width: menuWidth, height: menuHeight } = ref.getBoundingClientRect()
    const { innerWidth, innerHeight } = window
    // restore styling to resume anumations
    ref.setAttribute('style', sav)

    const minWidth = anchorDim.width
    let top = anchorDim.bottom
    let left = anchorDim.left

    let right = null
    let bottom = null
    if (left + Math.max(menuWidth, minWidth) > innerWidth) {
      left = null
      right = innerWidth - anchorDim.right
    }
    if (
      anchorDim.top - menuHeight >= 0 &&
      innerHeight < anchorDim.bottom + menuHeight
    ) {
      top = null
      bottom = innerHeight - anchorDim.top
    }
    Object.assign(ref.style, {
      top: top !== null ? `${top}px` : '',
      left: left !== null ? `${left}px` : '',
      right: right !== null ? `${right}px` : '',
      bottom: bottom !== null ? `${bottom}px` : '',
      minWidth: `${minWidth}px`
    })
    if (ref.children.length && takesFocus) {
      const idx = options.indexOf(value)
      if (idx >= 0 && !value.disabled) {
        ref.children.item(idx).focus()
      } else {
        handleFocus(null, true)
      }
    }
  }

  function handleMenuKeyDown(evt) {
    switch (evt.key) {
      case 'ArrowDown':
        handleFocus(evt, true)
        break
      case 'ArrowUp':
        handleFocus(evt, false)
        break
      case 'Home':
        document.activeElement?.blur()
        handleFocus(evt, true)
        break
      case 'End':
        document.activeElement?.blur()
        handleFocus(evt, false)
        break
      case 'Escape':
      case 'Tab':
        toggleVisibility()
        break
    }
  }

  function handleItemKeyDown(evt, option) {
    if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'ArrowRight') {
      if (option.Component) {
        option.props.open = true
        evt.stopPropagation()
      } else {
        select(option)
      }
    }
  }

  function handleItemClick(evt, option) {
    if (option.Component) {
      option.props.open = true
      evt.stopPropagation()
    } else if (!option?.disabled) {
      select(option)
    }
  }

  function handleFocus(evt, next) {
    const prop = next ? 'nextElementSibling' : 'previousElementSibling'
    let focusable
    let current =
      ref.querySelector('[role="menuitem"]:focus') ??
      ref.querySelector('[role="menuitem"].current')
    if (current) {
      focusable = current[prop]
    } else {
      focusable = ref[next ? 'firstElementChild' : 'lastElementChild']
    }
    // note that JSDom does not support focusable?.ariaDisabled === 'true'
    while (focusable?.getAttribute('aria-disabled') === 'true') {
      focusable = focusable[prop]
    }
    if (focusable) {
      focusable.focus()
      evt?.preventDefault()
    }
  }
</script>

<style type="postcss">
  ul {
    @apply absolute rounded z-20 text-sm shadow-md;
    background-color: theme('backgrounds.page');
  }

  li {
    @apply p-2 whitespace-nowrap flex items-center;

    &:first-of-type {
      @apply rounded-t;
    }

    &:last-of-type {
      @apply rounded-b;
    }

    &:not(.disabled) {
      &:hover,
      &:focus {
        @apply cursor-pointer outline-none;
        color: theme('colors.primary.text');
        background-color: theme('colors.primary.dark');
      }
      &.current {
        color: theme('colors.primary.text');
        background-color: theme('colors.primary.main');
      }
    }

    & > i {
      @apply mr-2 text-base;
    }
  }
</style>

<svelte:window
  on:click|capture={handleInteraction}
  on:resize|capture={handleVisible}
/>

{#if open && anchor && options?.length}
  <Portal>
    <ul
      role="menu"
      tabindex="-1"
      transition:slide
      on:introstart={handleVisible}
      on:keydown={handleMenuKeyDown}
      on:focus={evt => handleFocus(evt, ref.dataset.focusNext !== 'false')}
      bind:this={ref}
    >
      {#each options as option}
        <li
          role="menuitem"
          aria-disabled={option.disabled}
          class:disabled={option.disabled}
          class:current={option === value}
          tabindex={option.disabled ? undefined : -1}
          on:click={evt => handleItemClick(evt, option)}
          on:keydown={evt => handleItemKeyDown(evt, option)}
          on:focus={() => (option.props ? (option.props.focus = true) : null)}
          on:blur={() => (option.props ? (option.props.focus = false) : null)}
        >
          {#if option.Component}
            <svelte:component
              this={option.Component}
              {...option.props}
              on:close={() => {
                option.props.open = false
                dispatch('select', option)
              }}
              on:close={handleInteraction}
            />
          {:else}
            {#if option.icon}<i class="material-icons">{option.icon}</i>{/if}
            {option.label || option}
          {/if}
        </li>
      {/each}
    </ul>
  </Portal>
{/if}
