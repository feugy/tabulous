<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { CameraSwitch } from '../../src/components'
</script>

<ToolBox
  component={CameraSwitch}
  name="Components/Camera Switch"
  props={{ longTapDelay: 250 }}
  events={['save', 'restore', 'longTap']}
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
