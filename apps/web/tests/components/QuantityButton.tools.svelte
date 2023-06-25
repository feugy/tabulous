<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { QuantityButton } from '@src/components'
</script>

<ToolBox
  component={QuantityButton}
  name="Components/Quantity Button"
  props={{ disabled: false, primary: false }}
  events={['click']}
  layout="centered"
>
  <Tool name="Default" props={{ icon: 'front_hand' }} />
  <Tool name="Primary" props={{ icon: 'send', primary: true }} />
  <Tool name="Disabled" props={{ icon: 'stop', disabled: true }} />
</ToolBox>
