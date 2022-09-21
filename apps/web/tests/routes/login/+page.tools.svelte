<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import LoginPage from '../../../src/routes/login/+page.svelte'
</script>

<ToolBox component={LoginPage} name="Routes/login">
  <Tool name="Default" />
  <Tool name="With errors" props={{ form: [{ message: 'Forbidden' }] }} />
</ToolBox>
