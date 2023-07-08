<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Header } from '@src/components'
  import { setSvelteUrl } from '@tests/atelier/setup'
</script>

<ToolBox
  component={Header}
  name="Components/Header"
  setup={() => setSvelteUrl('/home')}
>
  <Tool name="Anonymous" props={{}} />
  <Tool
    name="Authenticated"
    props={{
      user: {
        id: 'abc123',
        username: 'Jane Doe'
      }
    }}
  />
</ToolBox>
