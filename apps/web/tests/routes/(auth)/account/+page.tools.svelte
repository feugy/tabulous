<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'

  import AccountPage from '../../../../src/routes/(auth)/account/+page.svelte'

  const manualPlayer = {
    id: 'jane-doe-123',
    username: 'Jane Doe',
    avatar: 'https://avatars.dicebear.com/api/micah/tabulous-avatar-4.svg'
  }
  const oauthPlayer = {
    id: 'abc123',
    provider: 'google',
    username: 'John Clark',
    email: 'john.clark@gmail.com',
    avatar: 'https://avatars.dicebear.com/api/micah/tabulous-avatar-10.svg'
  }
</script>

<ToolBox component={AccountPage} name="Routes/account">
  <Tool
    name="Manual account"
    props={{ data: { session: { player: manualPlayer } } }}
  />
  <Tool
    name="OAuth account"
    props={{ data: { session: { player: oauthPlayer } } }}
  />
</ToolBox>
