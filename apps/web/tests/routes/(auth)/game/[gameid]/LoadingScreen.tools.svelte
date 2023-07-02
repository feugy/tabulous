<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { actionNames, buttonIds } from '@src/3d/utils/actions'
  import LoadingScreen from '@src/routes/(auth)/game/[gameId]/LoadingScreen'

  const { button1, button2, button3 } = buttonIds
  const { flip, draw, random, detail, rotate } = actionNames
</script>

<ToolBox
  component={LoadingScreen}
  name="Routes/game/[gameId]/Loading Screen"
  props={{
    visible: true,
    actionNamesByButton: new Map([
      [button1, [flip, random]],
      [button2, [detail]],
      [button3, [rotate]]
    ])
  }}
>
  <Tool name="Default actions" />
  <Tool
    name="Custom actions"
    props={{
      actionNamesByButton: new Map([
        [button1, [rotate]],
        [button3, [draw]]
      ])
    }}
  />
  <Tool name="No actions" props={{ actionNamesByButton: null }} />
</ToolBox>
