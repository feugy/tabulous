<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import { push } from 'svelte-spa-router'
  import { Dropdown } from '../components'
  import {
    areIndicatorsVisible,
    isFullscreen,
    toggleFullscreen,
    toggleIndicators
  } from '../stores'

  const dispatch = createEventDispatcher()

  $: options = [
    { icon: 'home', label: $_('actions.quit-game') },
    { icon: 'connect_without_contact', label: $_('actions.invite-player') },
    {
      icon: $isFullscreen ? 'fullscreen_exit' : 'fullscreen',
      label: $_(
        $isFullscreen ? 'actions.leave-fullscreen' : 'actions.enter-fullscreen'
      )
    },
    {
      icon: $areIndicatorsVisible ? 'label_off' : 'label',
      label: $_(
        $areIndicatorsVisible
          ? 'actions.hide-indicators'
          : 'actions.show-indicators'
      )
    }
  ]

  function handleSelect({ detail: value }) {
    if (value === options[0]) {
      if ($isFullscreen) {
        toggleFullscreen()
      }
      push('/home')
    } else if (value === options[1]) {
      dispatch('invite-player')
    } else if (value === options[2]) {
      toggleFullscreen()
    } else if (value === options[3]) {
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
