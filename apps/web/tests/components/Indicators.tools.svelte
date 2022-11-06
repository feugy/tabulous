<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import { Indicators } from '../../src/components'
</script>

<ToolBox component={Indicators} name="Components/Indicators" layout="centered">
  <Tool
    name="Single"
    props={{
      items: [
        { screenPosition: { x: 50, y: 100 }, size: 5, id: 'card1', mesh: {} }
      ]
    }}
  />
  <Tool
    name="For player"
    props={{
      items: [
        {
          screenPosition: { x: 150, y: 125 },
          player: { username: 'Gaspard' },
          id: '123456.drop-zone.anchor-0',
          mesh: {}
        }
      ]
    }}
  />
  <Tool
    name="Peer pointer"
    props={{
      items: [
        {
          screenPosition: { x: -150, y: -125 },
          player: { username: 'Gaspard' },
          id: 'pointer-123'
        }
      ]
    }}
  />
  <Tool
    name="Feedback for action"
    props={{
      feedbacks: [
        {
          screenPosition: { x: 50, y: 200 },
          action: 'push',
          id: '1234'
        }
      ]
    }}
  />
  <Tool
    name="Feedback for player"
    props={{
      feedbacks: [
        {
          screenPosition: { x: 50, y: 200 },
          player: { username: 'Jane' },
          id: '1234'
        }
      ]
    }}
  />
  <Tool
    name="Multiple"
    props={{
      items: [
        { screenPosition: { x: 50, y: 100 }, size: 5, id: 'card1', mesh: {} },
        { screenPosition: { x: 150, y: 200 }, size: 27, id: 'card2', mesh: {} }
      ]
    }}
  />
  <Tool
    name="All kinds"
    props={{
      items: [
        {
          screenPosition: { x: 150, y: 125 },
          player: { username: 'Gaspard' },
          id: '123456.drop-zone.anchor-0',
          mesh: {}
        },
        {
          screenPosition: { x: 150, y: 125 },
          size: 3,
          id: 'card2.stack-size',
          mesh: {}
        },
        {
          screenPosition: { x: -150, y: -125 },
          player: { username: 'Gaspard' },
          id: 'pointer-123'
        }
      ],
      feedbacks: [
        {
          screenPosition: { x: 50, y: 200 },
          action: 'push',
          id: '1234'
        },
        {
          screenPosition: { x: 100, y: 200 },
          player: { username: 'Jane' },
          id: '2345'
        }
      ]
    }}
  />
</ToolBox>
