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
    name="Player"
    props={{
      items: [
        {
          screenPosition: { x: 150, y: 125 },
          username: 'Gaspard',
          id: '123456.drop-zone.anchor-0'
        }
      ]
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
  <Tool
    name="Player and stack"
    props={{
      items: [
        {
          screenPosition: { x: 150, y: 125 },
          username: 'Gaspard',
          id: '123456.drop-zone.anchor-0'
        },
        {
          screenPosition: { x: 150, y: 125 },
          size: 3,
          id: 'card2.stack-size'
        }
      ]
    }}
  />
</ToolBox>
