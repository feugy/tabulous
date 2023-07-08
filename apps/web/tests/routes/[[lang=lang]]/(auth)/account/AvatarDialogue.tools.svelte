<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import AvatarDialogue from '@src/routes/[[lang=lang]]/(auth)/account/AvatarDialogue.svelte'
</script>

<ToolBox
  component={AvatarDialogue}
  name="Routes/account/Avatar dialogue"
  props={{
    open: true,
    avatar: 'https://avatars.dicebear.com/api/micah/tabulous-avatar-4.svg'
  }}
  events={['close']}
>
  <Tool name="Default" />
  <Tool name="Empty" props={{ open: true, avatar: null }} />
</ToolBox>
