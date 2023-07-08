<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import LoginPage from '@src/routes/[[lang=lang]]/login/+page.svelte'
  import { setSvelteUrl } from '@tests/atelier/setup'
</script>

<ToolBox
  component={LoginPage}
  name="Routes/login"
  setup={() => setSvelteUrl('/login')}
>
  <Tool name="Default" />
  <Tool name="With errors" props={{ form: [{ message: 'Forbidden' }] }} />
</ToolBox>
