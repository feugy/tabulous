<script context="module">
  // @ts-check
  let nextId = 1
</script>

<script>
  // @ts-check
  /** @typedef {import('@src/components').SectionTab} SectionTab */

  import { buildCornerClipPath } from '@src/utils/dom'
  import { createEventDispatcher } from 'svelte'

  import Button from './Button.svelte'

  /** @type {boolean} whether this section is minimized. */
  export let minimized = false
  /** @type {'top'|'bottom'|'left'|'right'} placement for this section within its absolute parent. */
  export let placement = 'top'
  /** @type {string|undefined} initial dimension: width for left/right sections, height for top/bottom sections. */
  export let dimension = undefined
  /** @type {SectionTab[]|undefined} optional list of tabs inside this this section. */
  export let tabs = undefined
  /** @type {number} index of the current tab, if any.*/
  export let currentTab = 0

  const id = `minimizable-section-${nextId++}`

  $: vertical = placement === 'top' || placement === 'bottom'
  /** @type {{ node: 'offsetHeight'|'offsetWidth', event: 'x'|'y', style: 'width'|'height', negate: boolean, transition: string }} */
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
    : /** @type {SectionTab[]} */ ([
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
      ])
  $: tabIndexPerKey = new Map(innerTabs.map(({ key }, index) => [key, index]))

  /** @type {import('svelte').EventDispatcher<{ change: { currentTab: number }, minimize: { minimized: boolean }, resize: { size: number }}>} */
  let dispatch = createEventDispatcher()
  let isResizing = false
  let innerDimension = dimension ?? '25vw'
  /** @type {MouseEvent} */
  let previousEvent
  /** @type {HTMLElement} */
  let node
  /** @type {number} */
  let size

  // https://yqnn.github.io/svg-path-editor/
  $: [cornerId1, corner1] = buildCornerClipPath({ placement })
  $: [cornerId2, corner2] = buildCornerClipPath({ placement, inverted: true })

  function handleClick(/** @type {number} */ tabRank) {
    const shouldChange = tabRank !== currentTab
    if (shouldChange) {
      currentTab = tabRank
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

  function handleDown(/** @type {MouseEvent} */ event) {
    isResizing = false
    if (!minimized) {
      event.preventDefault()
      previousEvent = event
      size = node[props.node] ?? 0
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    }
  }

  function handleMove(/** @type {MouseEvent} */ event) {
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

  function handleKey(/** @type {KeyboardEvent} */ event) {
    const index = tabIndexPerKey.get(event.key)
    const element = /** @type {HTMLElement} */ (event.target)
    if (
      index !== undefined &&
      !element.isContentEditable &&
      element.nodeName !== 'INPUT'
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
        style="--corner1: url(#{cornerId1}); --corner2: url(#{cornerId2});"
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
        <clipPath id={cornerId1} clipPathUnits="objectBoundingBox">
          <path {...corner1} />
        </clipPath>
        <clipPath id={cornerId2} clipPathUnits="objectBoundingBox">
          <path {...corner2} />
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
