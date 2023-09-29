<script>
  // @ts-check
  import { buttonIds } from '@src/3d/utils/actions'
  import { isTouchScreen } from '@src/utils'
  import { _ } from 'svelte-intl'

  import HelpButton1 from './HelpButton1.svelte'
  import HelpButton2 from './HelpButton2.svelte'
  import HelpButton3 from './HelpButton3.svelte'
  import HelpKey from './HelpKey.svelte'
  import Skeleton from './Skeleton.svelte'

  /** @type {Map<keyof import('@tabulous/types').ActionSpec, import('@tabulous/types').ActionName[]>} map of action names by a given button. */
  export let actionNamesByButton = new Map()
  /** @type {Map<string, import('@tabulous/types').ActionName[]>} map of action names by a given shorcut. */
  export let actionNamesByKey = new Map()

  const isTouch = isTouchScreen()
  const tone = 'base-lighter'

  const iconPromise = import('@src/svg/help')

  $: button1Actions = actionNamesByButton?.get(buttonIds.button1)
  $: button2Actions = actionNamesByButton?.get(buttonIds.button2)

  function mapToLabels(
    /** @type {import('@tabulous/types').ActionName[]} */ actions
  ) {
    return actions.map(action => $_(`labels.help-${action}`)).join('<br/>')
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -->
<div>
  <h3>{$_('titles.object-controls')}</h3>
  <dl>
    <dt><HelpButton3 /></dt>
    <dd>{$_('labels.help-open-menu')}</dd>
    {#if button1Actions?.length}
      <dt><HelpButton1 /></dt>
      <dd>{@html mapToLabels(button1Actions)}</dd>
    {/if}
    {#if button2Actions?.length}
      <dt><HelpButton2 /></dt>
      <dd>{@html mapToLabels(button2Actions)}</dd>
    {/if}
    <dt>
      {#await iconPromise}
        <Skeleton height="55px" {tone} />
      {:then { LeftDragObject, PointerDragObject }}
        {#if isTouch}<PointerDragObject />{:else}
          <LeftDragObject />{/if}
      {/await}
    </dt>
    <dd>{$_('labels.help-move')}</dd>
    <dt>
      {#await iconPromise}
        <Skeleton height="55px" {tone} />
      {:then { LeftDrag, PointerDrag }}
        {#if isTouch}<PointerDrag />{:else}
          <LeftDrag />{/if}
      {/await}
    </dt>
    <dd>{$_('labels.help-add-to-selection')}</dd>
    <dt>
      {#await iconPromise}
        <Skeleton height="80px" {tone} />
      {:then { LeftOutside, PointerOutside }}
        {#if isTouch}<PointerOutside />{:else}
          <LeftOutside />{/if}
      {/await}
    </dt>
    <dd>{$_('labels.help-clear-selection')}</dd>
    <dt>
      {#await iconPromise}
        <Skeleton height="74px" {tone} />
      {:then { HoverObject, LongPointerObject }}
        {#if isTouch}<LongPointerObject />{:else}
          <HoverObject />{/if}
      {/await}
    </dt>
    <dd>{$_('labels.help-detail')}</dd>
  </dl>

  <h3>{$_('titles.camera-controls')}</h3>
  <dl>
    <dt>
      {#await iconPromise}
        <Skeleton height="55px" {tone} />
      {:then { Arrows, RightDrag, TwoPointersDrag }}
        {#if isTouch}<TwoPointersDrag />{:else}
          <RightDrag />{/if}
        <Arrows />
      {/await}
    </dt>
    <dd>{$_('labels.help-pan-camera')}</dd>
    <dt>
      {#await iconPromise}
        <Skeleton height="74px" {tone} />
      {:then { CtrlArrows, MiddleDrag, ThreePointersDrag }}
        {#if isTouch}<ThreePointersDrag />{:else}
          <MiddleDrag />{/if}
        <CtrlArrows />
      {/await}
    </dt>
    <dd>{$_('labels.help-rotate-camera')}</dd>
    <dt>
      {#await iconPromise}
        <Skeleton height="70px" {tone} />
      {:then { MouseWheel, Pinch }}
        {#if isTouch}<Pinch />{:else}
          <MouseWheel />{/if}
      {/await}
    </dt>
    <dd>{$_('labels.help-zoom')}</dd>
    <dt>
      <i class="material-icons">video_call</i>
      {#await iconPromise then { CtrlNumbers }}<CtrlNumbers />{/await}
    </dt>
    <dd>{$_('labels.help-new-camera')}</dd>
    <dt>
      <span class="badge"><i class="material-icons">videocam</i></span>
      {#await iconPromise then { Numbers }}<Numbers />{/await}
    </dt>
    <dd>{$_('labels.help-restore-camera')}</dd>
    <dt>
      <span class="badge"
        ><i class="material-icons">videocam</i><i class="halo" /></span
      >
      {#await iconPromise then { CtrlNumbers }}<CtrlNumbers />{/await}
    </dt>
    <dd>{$_('labels.help-save-camera')}</dd>
  </dl>

  <h3>{$_('titles.object-shortcuts')}</h3>
  <dl class="shortcuts">
    {#each actionNamesByKey?.entries() as [key, actions]}
      <dt>
        <HelpKey {key} height="50px" {tone} />
      </dt>
      <dd>{actions.map(name => $_(`tooltips.${name}`)).join(', ')}</dd>
    {/each}
  </dl>
</div>

<style lang="postcss">
  div {
    @apply p-4 h-full overflow-auto;
  }

  dl {
    @apply grid;
    grid-template-columns: repeat(auto-fill, 150px minmax(200px, 1fr));

    :global(svg) {
      @apply w-16 h-auto;
    }

    &.shortcuts {
      grid-template-columns: repeat(auto-fill, 75px minmax(125px, 1fr));
    }
  }

  dt,
  dd {
    @apply inline-grid items-center p-2;
  }

  dt {
    @apply gap-2 grid-flow-col auto-cols-fr justify-items-center;
  }

  dt:nth-of-type(even),
  dd:nth-of-type(even) {
    @apply bg-$base-lighter;
  }

  h3 {
    @apply text-xl font-bold pb-1 pt-4;
  }

  .halo {
    @apply absolute w-8 h-8 rounded-full left-1/2 top-1/2 transform-gpu -translate-x-1/2 -translate-y-1/2;
    box-shadow: 0 0 0.7rem 0 var(--svg-highlight);

    &::after {
      @apply absolute -top-2 left-[105%] not-italic;
      color: var(--svg-highlight);
      font-family: var(--font-heading);
      content: '1s';
    }
  }

  .badge {
    @apply relative;

    &::before {
      @apply absolute rounded-full leading-4 text-xs p-0.5
         flex justify-center items-center bg-$base-darkest
         text-$ink-dark -top-4 -left-4 min-w-5;
      font-family: var(--font-base);
      content: '1';
    }
  }
</style>
