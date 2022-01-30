<script>
  import { Tool, recordEvent } from '@atelier-wb/svelte'
  import { Button, RadialMenu } from '../../src/components'

  let open = true
</script>

<Tool
  name="Components/Radial Menu"
  props={{
    x: '25%',
    y: '25%',
    items: [
      { icon: 'home', onClick: () => recordEvent('click', 'home') },
      {
        icon: 'settings',
        secondary: true,
        onClick: () => recordEvent('click', 'settings')
      },
      {
        icon: 'face',
        secondary: true,
        onClick: () => recordEvent('click', 'face')
      },
      { icon: 'lock', onClick: () => recordEvent('click', 'lock') }
    ]
  }}
  events={['click']}
  let:props
  layout="centered"
>
  <RadialMenu bind:open {...props} />
  <Button
    on:click={() => {
      open = !open
    }}>{open ? 'Close' : 'Open'}</Button
  >
</Tool>
