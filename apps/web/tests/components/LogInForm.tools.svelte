<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { LogInForm } from '../../src/components'
</script>

<ToolBox component={LogInForm} name="Components/Log-in Form" layout="padded">
  <Tool name="Default state" />
  <Tool name="with password values" props={{ id: 'John', password: 'abcd' }} />
  <Tool
    name="With password error"
    props={{
      withGoogle: true,
      id: 'John',
      password: 'abcd',
      error: 'Authentication failed!'
    }}
  />
  <Tool name="With Google provider" props={{ withGoogle: true }} />
  <Tool name="With Github provider" props={{ withGithub: true }} />
  <Tool
    name="With all providers"
    props={{ withGithub: true, withGoogle: true }}
  />
</ToolBox>
