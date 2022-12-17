<script>
  import { recordEvent, Tool, ToolBox } from '@atelier-wb/svelte'
  import Indicators from '@src/routes/(auth)/game/[gameId]/Indicators.svelte'
</script>

<ToolBox
  component={Indicators}
  name="Routes/game/[gameId]/Indicators"
  layout="centered"
>
  <Tool
    name="Single"
    props={{
      items: [
        {
          screenPosition: { x: 50, y: 100 },
          size: 5,
          id: 'card1',
          mesh: {},
          onClick: () => recordEvent('select')
        }
      ]
    }}
  />
  <Tool
    name="For player"
    props={{
      items: [
        {
          screenPosition: { x: 150, y: 125 },
          player: { username: 'Gaspard', color: '#967d3e' },
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
          screenPosition: { x: -150, y: 125 },
          player: { username: 'Gaspard', color: '#567cdc' },
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
          player: { username: 'Jane', color: '#ffa280' },
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
          player: { username: 'Gaspard', color: 'cyan' },
          id: '123456.drop-zone.anchor-0',
          mesh: {}
        },
        {
          screenPosition: { x: 150, y: 140 },
          size: 3,
          id: 'card2.stack-size',
          mesh: {}
        },
        {
          screenPosition: { x: -150, y: 125 },
          player: { username: 'Gaspard', color: 'purple' },
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
          player: { username: 'Jane', color: '#369d2b' },
          id: '2345'
        }
      ]
    }}
  />
</ToolBox>
