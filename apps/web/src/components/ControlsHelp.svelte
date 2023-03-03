<script context="module">
  import { browser } from '$app/environment'

  let isTouch = false
  if (browser) {
    isTouch = navigator?.maxTouchPoints > 0
  }
</script>

<script>
  import {
    DoubleLeftObject,
    DoublePointerObject,
    LeftDrag,
    LeftDragObject,
    LeftObject,
    LeftOutside,
    LongLeftObject,
    LongPointerObject,
    MiddleDrag,
    MouseWheel,
    Pinch,
    PointerDrag,
    PointerDragObject,
    PointerObject,
    PointerOutside,
    RightDrag,
    RightObject,
    ThreePointersDrag,
    TwoPointersDrag,
    TwoPointersObject
  } from '@src/svg/help'
  import { _ } from 'svelte-intl'
</script>

<div>
  <h3>{$_('titles.object-controls')}</h3>
  <dl>
    <dt>
      {#if isTouch}<TwoPointersObject />{:else} <RightObject />{/if}
    </dt>
    <dd>{$_('labels.help-open-menu')}</dd>
    <dt>
      {#if isTouch}<PointerObject />{:else} <LeftObject />{/if}
    </dt>
    <dd>{$_('labels.help-flip')}</dd>
    <dt>
      {#if isTouch}<LongPointerObject />{:else} <LongLeftObject />{/if}
    </dt>
    <dd>{$_('labels.help-rotate')}</dd>
    <dt>
      {#if isTouch}<DoublePointerObject />{:else} <DoubleLeftObject />{/if}
    </dt>
    <dd>{$_('labels.help-detail')}</dd>
    <dt>
      {#if isTouch}<PointerDragObject />{:else} <LeftDragObject />{/if}
    </dt>
    <dd>{$_('labels.help-move')}</dd>
    <dt>
      {#if isTouch}<PointerDrag />{:else} <LeftDrag />{/if}
    </dt>
    <dd>{$_('labels.help-add-to-selection')}</dd>
    <dt>
      {#if isTouch}<PointerOutside />{:else} <LeftOutside />{/if}
    </dt>
    <dd>{$_('labels.help-clear-selection')}</dd>
  </dl>

  <h3>{$_('titles.camera-controls')}</h3>
  <dl>
    <dt>
      {#if isTouch}<TwoPointersDrag />{:else} <RightDrag />{/if}
    </dt>
    <dd>{$_('labels.help-pan-camera')}</dd>
    <dt>
      {#if isTouch}<ThreePointersDrag />{:else} <MiddleDrag />{/if}
    </dt>
    <dd>{$_('labels.help-rotate-camera')}</dd>
    <dt>
      {#if isTouch}<Pinch />{:else} <MouseWheel />{/if}
    </dt>
    <dd>{$_('labels.help-zoom')}</dd>
  </dl>
  <!--ControlHelp actions={[NewCamera]} label={$_('labels.new-camera')} /-->
  <!--ControlHelp actions={[RestoreCamera]} label={$_('labels.restore-camera')} /-->
  <!--ControlHelp actions={[UpdateCamera]} label={$_('labels.save-camera')} /-->
</div>

<style lang="postcss">
  div {
    @apply p-4 h-full overflow-auto;
  }

  dl {
    @apply grid;
    grid-template-columns: repeat(auto-fill, 80px minmax(200px, 1fr));

    :global(svg) {
      @apply h-16 w-auto;
    }
  }

  dt,
  dd {
    @apply flex items-center p-2;
  }

  dt:nth-of-type(even) {
    @apply bg-$base-lighter;
  }
  dd:nth-of-type(even) {
    @apply bg-$base-lighter;
  }

  h3 {
    @apply text-xl font-bold pb-1 pt-4;
  }
</style>
