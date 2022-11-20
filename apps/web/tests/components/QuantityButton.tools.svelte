<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { QuantityButton } from '@src/components'
</script>

<ToolBox
  component={QuantityButton}
  name="Components/Quantity Button"
  props={{ disabled: false, secondary: false }}
  events={['click']}
  layout="centered"
>
  <Tool name="Default" props={{ icon: 'front_hand' }} />
  <Tool name="Secondary" props={{ icon: 'send', secondary: true }} />
  <Tool name="Disabled" props={{ icon: 'stop', disabled: true }} />
</ToolBox>
