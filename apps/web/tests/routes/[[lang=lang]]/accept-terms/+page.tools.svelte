<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import AcceptTermsPage from '@src/routes/[[lang=lang]]/accept-terms/+page.svelte'
  import { setSvelteUrl } from '@tests/atelier/setup'
</script>

<ToolBox
  component={AcceptTermsPage}
  name="Routes/accept-terms"
  setup={() => setSvelteUrl('/accept-terms')}
  props={{ data: {} }}
>
  <Tool name="Default" />
</ToolBox>
