<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Discussion } from '../../src/components'
  import { players, thread } from './Discussion.testdata'
</script>

<main class="w-1/3 m-auto">
  <ToolBox
    component={Discussion}
    name="Components/Discussion"
    props={{ players }}
    events={['sendMessage']}
  >
    <Tool name="Long thread" props={{ thread }} />

    <Tool
      name="short thread"
      props={{
        thread: [{ playerId: '369258', text: 'Aww yeah!!' }]
      }}
    />
  </ToolBox>
</main>
