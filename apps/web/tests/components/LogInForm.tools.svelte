<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { LogInForm } from '../../src/components'
</script>

<ToolBox
  component={LogInForm}
  name="Components/Log-in Form"
  events={['submit']}
  layout="padded"
>
  <Tool name="Default state" />
  <Tool
    name="with password values"
    props={{ username: 'John', password: 'abcd' }}
  />
  <Tool
    name="With password error"
    props={{
      username: 'John',
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
