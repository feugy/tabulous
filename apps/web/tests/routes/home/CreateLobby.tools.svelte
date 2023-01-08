<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import CreateLobby from '@src/routes/home/CreateLobby.svelte'
</script>

<ToolBox
  component={CreateLobby}
  name="Routes/home/Create lobby"
  events={['select']}
  layout="centered"
>
  <Tool name="Default" />
</ToolBox>
