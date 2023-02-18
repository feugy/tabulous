<script>
  import { Dropdown } from '@src/components'
  import {
    areIndicatorsVisible,
    isFullscreen,
    toggleFullscreen,
    toggleIndicators
  } from '@src/stores'
  import { _ } from 'svelte-intl'

  import { goto } from '$app/navigation'

  const homeAction = 'home'
  const fullscreenAction = 'fullscreen'
  const indicatorsAction = 'indicators'
  let value = null

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
      goto('/home')
    } else if (value?.id === fullscreenAction) {
      toggleFullscreen()
    } else if (value?.id === indicatorsAction) {
      toggleIndicators()
    }
    setTimeout(() => (value = null), 0)
  }
</script>

<Dropdown
  icon="menu"
  title={$_('tooltips.game-menu')}
  withArrow={false}
  valueAsText={false}
  {options}
  bind:value
  on:select={handleSelect}
/>
