<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import CameraSwitch from '@src/routes/(auth)/game/[gameId]/CameraSwitch.svelte'
</script>

<ToolBox
  component={CameraSwitch}
  name="Routes/game/[gameId]/Camera Switch"
  props={{ longTapDelay: 250 }}
  events={['save', 'restore', 'longTap']}
  layout="centered"
>
  <Tool name="Single save" props={{ saves: [{ hash: 'a' }] }} />
  <Tool
    name="Multiple saves"
    props={{
      saves: [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }]
    }}
  />
  <Tool
    name="Multiple saves with current"
    props={{
      current: { hash: 'b' },
      saves: [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }]
    }}
  />
  <Tool
    name="Max count reached"
    props={{
      saves: [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }, { hash: 'd' }],
      maxCount: 3
    }}
  />
</ToolBox>
