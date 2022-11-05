<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import { goto } from '$app/navigation'

  import { Dropdown } from '../components'
  import {
    areIndicatorsVisible,
    currentGame,
    isFullscreen,
    toggleFullscreen,
    toggleIndicators
  } from '../stores'

  const dispatch = createEventDispatcher()

  const homeAction = 'home'
  const inviteAction = 'invite'
  const fullscreenAction = 'fullscreen'
  const indicatorsAction = 'indicators'

  $: options = [
    { icon: 'home', label: $_('actions.quit-game'), value: homeAction },
    ($currentGame?.availableSeats ?? 0) > 0
      ? {
          icon: 'connect_without_contact',
          label: $_('actions.invite-player'),
          value: inviteAction
        }
      : undefined,
    {
      icon: $isFullscreen ? 'fullscreen_exit' : 'fullscreen',
      label: $_(
        $isFullscreen ? 'actions.leave-fullscreen' : 'actions.enter-fullscreen'
      ),
      value: fullscreenAction
    },
    {
      icon: $areIndicatorsVisible ? 'label_off' : 'label',
      label: $_(
        $areIndicatorsVisible
          ? 'actions.hide-indicators'
          : 'actions.show-indicators'
      ),
      value: indicatorsAction
    }
  ].filter(Boolean)

  function handleSelect({ detail: { value } }) {
    if (value === homeAction) {
      if ($isFullscreen) {
        toggleFullscreen()
      }
      goto('/home')
    } else if (value === inviteAction) {
      dispatch('invite-player')
    } else if (value === fullscreenAction) {
      toggleFullscreen()
    } else if (value === indicatorsAction) {
      toggleIndicators()
    }
  }
</script>

<Dropdown
  icon="menu"
  title={$_('tooltips.game-menu')}
  withArrow={false}
  valueAsText={false}
  {options}
  on:select={handleSelect}
/>
