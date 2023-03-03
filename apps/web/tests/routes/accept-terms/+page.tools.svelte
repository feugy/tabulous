<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import AcceptTermsPage from '@src/routes/accept-terms/+page.svelte'
  import { setSvelteUrl } from '@tests/atelier/setup'
</script>

<ToolBox
  component={AcceptTermsPage}
  name="Routes/accept-terms"
  setup={() => setSvelteUrl('/accept-terms')}
>
  <Tool name="Default" />
</ToolBox>
