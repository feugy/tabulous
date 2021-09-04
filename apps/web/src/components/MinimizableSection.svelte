<script>
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'

  export let minimized = false
  export let placement = 'top'
  export let dimension = undefined
  export let icons = undefined
  export let currentTab = 0

  $: vertical = placement === 'top' || placement === 'bottom'
  $: props = vertical
    ? {
        style: 'height',
        event: 'y',
        node: 'offsetHeight',
        negate: placement === 'bottom'
      }
    : {
        style: 'width',
        event: 'x',
        node: 'offsetWidth',
        negate: placement === 'right'
      }
  $: innerIcons = Array.isArray(icons)
    ? icons
    : [
        minimized
          ? placement === 'top'
            ? 'expand_more'
            : placement === 'bottom'
            ? 'expand_less'
            : placement === 'left'
            ? 'navigate_next'
            : 'navigate_before'
          : placement === 'top'
          ? 'expand_less'
          : placement === 'bottom'
          ? 'expand_more'
          : placement === 'left'
          ? 'navigate_before'
          : 'navigate_next'
      ]

  let dispatch = createEventDispatcher()
  let hasMoved = false
  let innerDimension = dimension ?? 'auto'
  let previousEvent
  let node
  let size

  function handleClick(i) {
    const shouldChange = i !== currentTab
    if (shouldChange) {
      currentTab = i
      if (!minimized) {
        innerDimension = `${node[props.node]}px`
      }
      dispatch('change', { currentTab })
    }
    if (minimized || !shouldChange) {
      minimized = !minimized
      dispatch('minimize', { minimized })
    }
  }

  function handleDown(event) {
    hasMoved = false
    if (!minimized) {
      event.preventDefault()
      previousEvent = event
      size = node[props.node] ?? 0
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    }
  }

  function handleMove(event) {
    if (!hasMoved && (event.movementX || event.movementY)) {
      hasMoved = true
    }
    size +=
      (props.negate ? -1 : 1) *
      (event[props.event] - previousEvent[props.event])
    previousEvent = event
    innerDimension = `${size}px`
    dispatch('resize', { size })
  }

  function handleUp() {
    hasMoved = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }
</script>

<style type="postcss">
  section {
    @apply relative flex items-stretch justify-items-stretch h-full z-10;
    min-width: min-content;
    max-width: 100%;

    &:not(.vertical).minimized {
      width: 0 !important;
      min-width: 0;
    }

    &.vertical {
      @apply w-full h-auto;
      min-width: auto;
      max-width: auto;
      min-height: min-content;
      max-height: 100%;

      &.minimized {
        height: 0 !important;
        min-height: 0;
      }
    }
  }

  menu {
    @apply absolute h-full m-0 p-0 flex items-start;
    --offset: -42px;

    & .buttonContainer {
      @apply relative flex flex-col top-2 -right-2 z-30 gap-2;

      & .active {
        transform: scale(1.2);
      }
    }

    & .gutter {
      @apply relative border-none border-l-2 h-full z-20;
      border-style: solid;
      cursor: ew-resize;

      &:after {
        @apply absolute inline-block w-4 h-10 top-1/2 -mt-4 -ml-2 rounded;
        background-color: theme('colors.primary.light');
        content: '';
      }
    }

    &.right {
      left: var(--offset);
    }
    &.left {
      @apply flex-row-reverse;
      right: var(--offset);

      & .buttonContainer {
        @apply right-auto -left-2;
      }
    }

    &.vertical {
      @apply w-full h-auto flex-col;

      & .buttonContainer {
        @apply flex-row top-auto right-auto left-2 -bottom-2;
      }

      & .gutter {
        @apply w-full h-auto border-b-2;
        cursor: ns-resize;

        &:after {
          @apply w-10 h-4 top-auto left-1/2 -ml-4 -mt-2;
        }
      }

      &.top {
        @apply flex-col-reverse;
        bottom: var(--offset);

        & .buttonContainer {
          @apply bottom-auto -top-2;
        }
      }
      &.bottom {
        top: var(--offset);
      }
    }
  }

  span {
    @apply flex-1 overflow-hidden;
  }
</style>

<section
  role="region"
  class:minimized
  class:vertical
  bind:this={node}
  aria-expanded={!minimized}
  style="{props.style}: {innerDimension};"
>
  <menu class:vertical class={placement}>
    <ol role="tablist" class="buttonContainer">
      {#each innerIcons as icon, i}
        <li class:active={innerIcons.length > 1 && i === currentTab}>
          <Button
            role="tab"
            aria-selected={innerIcons.length > 1 && i === currentTab}
            {icon}
            on:click={() => handleClick(i)}
          />
        </li>
      {/each}
    </ol>
    <div role="scrollbar" class="gutter" on:pointerdown={handleDown} />
  </menu>
  <span>
    <slot />
  </span>
</section>
