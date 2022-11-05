<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import { Breadcrumb } from '../../src/components'
</script>

<ToolBox component={Breadcrumb} name="Components/Breadcrumb" layout="centered">
  <Tool name="Empty" />
  <Tool name="Single entry" props={{ steps: [{ href: '/', label: 'home' }] }} />
  <Tool
    name="Multiple entries"
    props={{
      steps: [
        { href: '/', label: 'home' },
        { href: '/account', label: 'account' },
        { href: '/account/details', label: 'details' }
      ]
    }}
  />
</ToolBox>
