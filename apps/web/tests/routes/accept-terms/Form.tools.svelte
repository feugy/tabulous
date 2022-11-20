<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import Form from '@src/routes/accept-terms/Form.svelte'
</script>

<ToolBox
  component={Form}
  name="Routes/accept-terms/Form"
  layout="padded"
  events={['submit']}
>
  <Tool name="Default" />
  <Tool name="Enabled" props={{ disabled: false }} />
</ToolBox>
