<script context="module">
  let nextId = 1
</script>

<script>
  import { buildCornerClipPath } from '@src/utils/dom'
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
        negate: placement === 'bottom',
        transition: 'height var(--short)'
      }
    : {
        style: 'width',
        event: 'x',
        node: 'offsetWidth',
        negate: placement === 'right',
        transition: 'width var(--short)'
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
  let isResizing = false
  let innerDimension = dimension ?? '25vw'
  let previousEvent
  let node
  let size

  // https://yqnn.github.io/svg-path-editor/
  $: corner1 = buildCornerClipPath({ placement })
  $: corner2 = buildCornerClipPath({ placement, inverted: true })

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
    isResizing = false
    if (!minimized) {
      event.preventDefault()
      previousEvent = event
      size = node[props.node] ?? 0
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    }
  }

  function handleMove(event) {
    if (!isResizing && (event.movementX || event.movementY)) {
      isResizing = true
    }
    size +=
      (props.negate ? -1 : 1) *
      (event[props.event] - previousEvent[props.event])
    previousEvent = event
    innerDimension = `${size}px`
    dispatch('resize', { size })
  }

  function handleUp() {
    isResizing = false
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
  aria-label="minimizable"
  style="{props.style}: {innerDimension};"
  style:transition={isResizing ? undefined : props.transition}
>
  {#if innerTabs.length}
    <menu class:vertical class={placement}>
      <ol
        role="tablist"
        style="--corner1: url(#{corner1.id}); --corner2: url(#{corner2.id});"
      >
        <li class="bg" />
        {#each innerTabs as { icon, key }, i}
          {@const active =
            innerTabs.length > 1 && i === currentTab && !minimized}
          <li class:active>
            <Button
              role="tab"
              aria-selected={active}
              aria-expanded={!minimized}
              transparent
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
      <svg style="width:0px; height:0px">
        <clipPath id={corner1.id} clipPathUnits="objectBoundingBox">
          <path
            d={corner1.d}
            transform-origin="0.5 0.5"
            transform={corner1.transform}
          />
        </clipPath>
        <clipPath id={corner2.id} clipPathUnits="objectBoundingBox">
          <path
            d={corner2.d}
            transform-origin="0.5 0.5"
            transform={corner2.transform}
          />
        </clipPath>
      </svg>
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

    ol[role='tablist'] {
      @apply relative flex flex-col top-12 gap-2 p-1 z-30 pointer-events-auto;
      --corner-overlap: 1.3rem;

      li {
        @apply relative z-1;
      }

      .bg {
        @apply absolute inset-x-0 bg-$base-darker;
        bottom: var(--corner-overlap);
        top: var(--corner-overlap);
      }

      &::before,
      &::after {
        @apply absolute h-12 w-full inset-x-0 bg-$base-darker z-0;
        content: '';
      }
      &::before {
        bottom: calc(100% - var(--corner-overlap) - 1px);
        clip-path: var(--corner1);
      }
      &::after {
        top: calc(100% - var(--corner-overlap) - 1px);
        clip-path: var(--corner2);
      }

      :global(button),
      :global(button:hover:not(:disabled)),
      :global(button:focus:not(:disabled)) {
        @apply text-$base-light;
      }

      .active {
        :global(button),
        :global(button:hover:not(:disabled)),
        :global(button:focus:not(:disabled)) {
          @apply bg-$base-light text-$ink;
        }
      }
    }

    .gutter {
      @apply relative z-20 pointer-events-auto bg-$base-darker h-full w-1;
      cursor: ew-resize;
    }

    &.right {
      @apply right-full;

      ol {
        @apply pr-0;
      }
    }

    &.left {
      @apply flex-row-reverse left-full;

      ol {
        @apply pl-0;
      }
    }

    &.vertical {
      @apply w-full h-auto flex-col;

      ol {
        @apply flex-row top-auto right-auto left-12;

        &::before,
        &::after {
          @apply h-full w-12 inset-y-0 inset-x-auto;
        }

        &::before {
          right: calc(100% - var(--corner-overlap) - 1px);
        }
        &::after {
          left: calc(100% - var(--corner-overlap) - 1px);
        }

        .bg {
          @apply inset-y-0;
          left: var(--corner-overlap);
          right: var(--corner-overlap);
        }
      }

      .gutter {
        @apply w-full h-1;
        cursor: ns-resize;
      }

      &.top {
        @apply flex-col-reverse top-full;

        ol {
          @apply pt-0;
        }
      }

      &.bottom {
        @apply bottom-full;

        ol {
          @apply pb-0;
        }
      }
    }
  }

  span {
    @apply flex-1 overflow-hidden;
  }
</style>
