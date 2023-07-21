<script context="module">
  import { browser } from '$app/environment'
  let selector = 'focus-within'
  if (browser) {
    selector = navigator.userAgent.includes('jsdom') ? 'focus' : 'focus-within'
  }
</script>

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
    if (option !== value) {
      value = option
      dispatch('select', value)
    }
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
    const anchorDim = anchor.getBoundingClientRect()
    const { innerWidth, innerHeight, scrollY } = window
    const sav = ref.getAttribute('style')
    // reset styling to get final menu dimension
    ref.setAttribute('style', '')
    const { width: menuWidth, height: menuHeight } = ref.getBoundingClientRect()
    // restore styling to resume animations
    ref.setAttribute('style', sav)

    const margin = 8
    const minWidth = anchorDim.width
    let top = anchorDim.bottom + scrollY + margin
    let left = anchorDim.left
    let bottom = null
    if (left + Math.max(menuWidth, minWidth) > innerWidth) {
      left = anchorDim.right - Math.max(menuWidth, minWidth)
    }
    if (anchorDim.bottom + menuHeight > innerHeight) {
      top = null
      bottom = document.body.clientHeight - (anchorDim.top + scrollY - margin)
    }
    Object.assign(ref.style, {
      top: top !== null ? `${top}px` : '',
      bottom: bottom !== null ? `${bottom}px` : '',
      left: left !== null ? `${left}px` : '',
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
      handleItemClick(evt, option)
    }
  }

  function handleItemClick(evt, option) {
    if (option.Component) {
      option.props.open = true
      // blur to let sub component take the focus
      document.activeElement.blur()
      evt.target.focus()
      evt.stopPropagation()
    } else if (!option?.disabled) {
      select(option)
    }
  }

  function handleFocus(evt, next) {
    const prop = next ? 'nextElementSibling' : 'previousElementSibling'
    let focusable
    let current =
      ref.querySelector(`[role="menuitem"]:${selector}`) ??
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

<svelte:window
  on:click|capture={handleInteraction}
  on:resize|capture={handleVisible}
/>

{#if open && anchor && options?.length}
  <Portal>
    <ul
      role="menu"
      tabindex="-1"
      transition:slide|global
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
            {#if option.color}<span
                class="color"
                style:--color={option.color}
              />{:else}{option.label || option}{/if}
          {/if}
        </li>
      {/each}
    </ul>
  </Portal>
{/if}

<style lang="postcss">
  ul {
    @apply absolute rounded z-20 text-sm shadow-md bg-$base-dark text-$ink-dark;
    box-shadow: 0px 7px 10px var(--shadow-color);
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
      &.current {
        @apply text-$ink-dark bg-$primary-dark;
      }
      &:hover,
      &:focus {
        @apply cursor-pointer outline-none bg-$base-darker;
      }
    }

    > i {
      @apply mr-2 text-base;
    }

    > .color {
      @apply inline-block w-full h-6;
      background-color: var(--color);
    }
  }
</style>
