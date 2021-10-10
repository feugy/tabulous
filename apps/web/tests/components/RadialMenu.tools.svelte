<script>
  import { Tool } from '@atelier-wb/svelte'
  import { RadialMenu } from '../../src/components'
</script>

<Tool
  component={RadialMenu}
  name="Components/Radial Menu"
  props={{
    open: true,
    x: '25%',
    y: '25%',
    items: [
      { icon: 'home' },
      { icon: 'settings', secondary: true },
      { icon: 'face', secondary: true },
      { icon: 'lock' }
    ]
  }}
  events={['close', 'select']}
  layout="centered"
/>
