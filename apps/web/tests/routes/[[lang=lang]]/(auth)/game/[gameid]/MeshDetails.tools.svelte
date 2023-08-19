<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import MeshDetails from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/MeshDetails.svelte'
</script>

<ToolBox
  component={MeshDetails}
  name="Routes/game/[gameId]/Mesh Details"
  events={['open', 'close']}
>
  <Tool
    name="Single"
    props={{
      details: {
        position: { x: 50, y: 150 },
        images: ['/assets/images/hearts-12.1.svg']
      }
    }}
  />
  <Tool
    name="Multiple"
    props={{
      details: {
        position: { x: 150, y: 50 },
        images: [
          '/assets/images/hearts-12.1.svg',
          '/assets/images/spades-12.1.svg',
          '/assets/images/diamonds-12.1.svg',
          '/assets/images/clubs-12.1.svg'
        ]
      }
    }}
  />
  <Tool
    name="Top right"
    props={{
      details: {
        position: { x: 0, y: 0 },
        images: ['/assets/images/hearts-13.1.svg']
      }
    }}
  />
  <Tool
    name="Top left"
    props={{
      details: {
        position: { x: 6000, y: 0 },
        images: ['/assets/images/clubs-13.1.svg']
      }
    }}
  />
  <Tool
    name="Bottom right"
    props={{
      details: {
        position: { x: 0, y: 5000 },
        images: ['/assets/images/spades-13.1.svg']
      }
    }}
  />
  <Tool
    name="Bottom left"
    props={{
      details: {
        position: { x: 6000, y: 5000 },
        images: ['/assets/images/diamonds-13.1.svg']
      }
    }}
  />
</ToolBox>
