<script>
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'

  export let minimized = false
  export let placement = 'top'
  export let dimension
  export let icon

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
  $: innerIcon =
    icon ??
    (minimized
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
      : 'navigate_next')

  let dispatch = createEventDispatcher()
  let hasMoved = false
  let innerDimension = dimension ?? 'auto'
  let previousEvent
  let node
  let size

  function handleClick() {
    minimized = !minimized
    dispatch('minimize', { minimized })
  }

  function handleDown(event) {
    hasMoved = false
    if (!minimized) {
      event.preventDefault()
      previousEvent = event
      size = node[props.node]
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
      @apply relative top-2 -right-2 z-30;
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
    }

    &.vertical {
      @apply w-full h-auto flex-col;

      & .buttonContainer {
        @apply top-auto right-auto left-2 -bottom-2;
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
  class:minimized
  class:vertical
  bind:this={node}
  style="{props.style}: {innerDimension};"
>
  <menu class:vertical class={placement}>
    <span class="buttonContainer">
      <Button icon={innerIcon} on:click={handleClick} />
    </span>
    <div class="gutter" on:pointerdown={handleDown} />
  </menu>
  <span>
    <slot />
  </span>
</section>
