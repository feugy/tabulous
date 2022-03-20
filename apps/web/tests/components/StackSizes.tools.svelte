<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { StackSizes } from '../../src/components'
</script>

<ToolBox component={StackSizes} name="Components/Stack sizes" layout="centered">
  <Tool
    name="Single"
    props={{
      items: [{ screenPosition: { x: 50, y: 100 }, size: 5, id: 'card1' }]
    }}
  />
  <Tool
    name="Multiple"
    props={{
      items: [
        { screenPosition: { x: 50, y: 100 }, size: 5, id: 'card1' },
        { screenPosition: { x: 150, y: 200 }, size: 27, id: 'card2' }
      ]
    }}
  />
</ToolBox>
