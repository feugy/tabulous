<script>
  // @ts-check
  import { Dropdown } from '@src/components'
  import { isFullscreen, toggleFullscreen } from '@src/stores'
  import {
    cameraSaves,
    currentCamera,
    longInputs,
    restoreCamera,
    saveCamera
  } from '@src/stores/game-engine'
  import {
    areIndicatorsVisible,
    toggleIndicators
  } from '@src/stores/indicators'
  import Logo from '@src/svg/tabulous-logo.svg?component'
  import { buildCornerClipPath } from '@src/utils'
  import { _, locale } from 'svelte-intl'

  import { goto } from '$app/navigation'

  import CameraSwitch from './CameraSwitch.svelte'

  /** @type {number} number of milliseconds to hold pointer down before it is considered as long. */
  export let longTapDelay
  const homeAction = 'home'
  const fullscreenAction = 'fullscreen'
  const indicatorsAction = 'indicators'
  const [cornerId, corner] = buildCornerClipPath({
    placement: 'top',
    inverted: true
  })
  /** @type {?import('@src/components').LabelMenuOption|undefined} */
  let value = null

  /** @type {import('@src/components').LabelMenuOption[]} */
  $: options = [
    { icon: 'home', label: $_('actions.quit-game'), id: homeAction },
    {
      icon: $isFullscreen ? 'fullscreen_exit' : 'fullscreen',
      label: $_(
        $isFullscreen ? 'actions.leave-fullscreen' : 'actions.enter-fullscreen'
      ),
      id: fullscreenAction
    },
    {
      icon: $areIndicatorsVisible ? 'label_off' : 'label',
      label: $_(
        $areIndicatorsVisible
          ? 'actions.hide-indicators'
          : 'actions.show-indicators'
      ),
      id: indicatorsAction
    }
  ]

  function handleSelect() {
    if (value?.id === homeAction) {
      if ($isFullscreen) {
        toggleFullscreen()
      }
      goto(`/${$locale}/home`)
    } else if (value?.id === fullscreenAction) {
      toggleFullscreen()
    } else if (value?.id === indicatorsAction) {
      toggleIndicators()
    }
    setTimeout(() => (value = null), 0)
  }
</script>

<aside style="--corner: url(#{cornerId});">
  <Dropdown
    title={$_('tooltips.game-menu')}
    withArrow={false}
    valueAsText={false}
    {options}
    bind:value
    on:select={handleSelect}><span slot="icon"><Logo /></span></Dropdown
  >
  <CameraSwitch
    {longTapDelay}
    current={$currentCamera}
    saves={$cameraSaves}
    on:longTap={({ detail: event }) => longInputs.next(event)}
    on:restore={({ detail: { index } }) => restoreCamera(index)}
    on:save={({ detail: { index } }) => saveCamera(index)}
  />
</aside>
<svg style="width:0px; height:0px">
  <clipPath id={cornerId} clipPathUnits="objectBoundingBox">
    <path {...corner} />
  </clipPath>
</svg>

<style lang="postcss">
  aside {
    @apply absolute z-10 top-0 left-0 p-2 flex gap-1;
    --corner-overlap: 1.3rem;

    &::before {
      @apply absolute inset-0 bg-$base-darker;
      content: '';
      right: var(--corner-overlap);
    }

    &::after {
      @apply absolute inset-y-0 w-12 -z-1 bg-$base-darker;
      left: calc(100% - var(--corner-overlap) - 1px);
      content: '';
      clip-path: var(--corner);
    }

    :global(button.transparent),
    :global(button.transparent:hover:not(:disabled)),
    :global(button.transparent:focus:not(:disabled)) {
      @apply !text-$base-light;
    }
    :global(button.transparent:disabled) {
      @apply !text-$base;
    }
  }

  span {
    @apply -mx-2;
  }
</style>
