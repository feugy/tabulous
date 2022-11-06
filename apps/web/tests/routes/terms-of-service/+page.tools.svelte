<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import TermsOfServicePage from '../../../src/routes/terms-of-service/+page.svelte'

  const player = { id: 'abc123', username: 'Jane Doe' }
</script>

<ToolBox component={TermsOfServicePage} name="Routes/terms-of-service">
  <Tool name="Anonymous" />
  <Tool
    name="Connected"
    props={{
      data: {
        session: { player }
      }
    }}
  />
</ToolBox>
