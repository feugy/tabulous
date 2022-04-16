<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Indicators } from '../../src/components'
</script>

<ToolBox component={Indicators} name="Components/Indicators" layout="centered">
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
