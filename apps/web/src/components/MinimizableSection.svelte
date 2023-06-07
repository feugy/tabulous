<script context="module">
  let nextId = 1
</script>

<script>
  import { createEventDispatcher } from 'svelte'

  import Button from './Button.svelte'

  export let minimized = false
  export let placement = 'top'
  export let dimension = undefined
  export let tabs = undefined
  export let currentTab = 0

  const id = `minimizable-section-${nextId++}`

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
  $: innerTabs = Array.isArray(tabs)
    ? tabs
    : [
        {
          icon: minimized
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
        }
      ]
  $: tabIndexPerkey = new Map(innerTabs.map(({ key }, index) => [key, index]))

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

  function handleKey(event) {
    const index = tabIndexPerkey.get(event.key)
    if (
      index !== undefined &&
      !event.target.isContentEditable &&
      event.target.nodeName !== 'INPUT'
    ) {
      handleClick(index)
      event.preventDefault()
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

<section
  {id}
  class:minimized
  class:vertical
  bind:this={node}
  aria-expanded={!minimized}
  aria-label="minimizable"
  style="{props.style}: {innerDimension};"
>
  {#if innerTabs.length}
    <menu class:vertical class={placement}>
      <ol role="tablist" class="buttonContainer">
        {#each innerTabs as { icon, key }, i}
          <li class:active={innerTabs.length > 1 && i === currentTab}>
            <Button
              role="tab"
              aria-selected={innerTabs.length > 1 && i === currentTab}
              badge={key}
              {icon}
              on:click={() => handleClick(i)}
            />
          </li>
        {/each}
      </ol>
      <div
        role="scrollbar"
        aria-controls={id}
        aria-valuenow={size}
        class="gutter"
        on:pointerdown|stopPropagation={handleDown}
      />
    </menu>
  {/if}
  <span>
    <slot />
  </span>
</section>

<style lang="postcss">
  section {
    @apply relative flex items-stretch justify-items-stretch h-full z-10 min-w-50 max-w-full;

    &:not(.vertical).minimized {
      @apply min-w-0 !w-0;
    }

    &.vertical {
      @apply w-full h-auto min-w-none max-w-none min-h-min max-h-full;

      &.minimized {
        @apply min-h-0 !h-0;
      }
    }
  }

  menu {
    @apply absolute h-full m-0 p-0 flex items-start pointer-events-none;
    --offset: -42px;

    & .buttonContainer {
      @apply relative flex flex-col top-6 -right-2 z-30 gap-2 pointer-events-auto;

      & .active {
        @apply transform-gpu scale-125;
      }
    }

    & .gutter {
      @apply relative border border-l-2 h-full z-20 pointer-events-auto border-$secondary-dark;
      cursor: ew-resize;

      &:after {
        @apply absolute inline-block w-4 h-10 top-1/2 -mt-4 -ml-2 rounded bg-$secondary-dark;
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
        @apply flex-row top-auto right-auto left-6 -bottom-2;
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
