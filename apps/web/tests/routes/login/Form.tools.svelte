<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import Form from '../../../src/routes/login/Form.svelte'
</script>

<ToolBox component={Form} name="Routes/login/Form" layout="padded">
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
