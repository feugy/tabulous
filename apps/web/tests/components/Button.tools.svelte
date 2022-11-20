<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Button } from '@src/components'
  import GithubLogo from '@src/svg/github-logo.svg'
</script>

<ToolBox
  component={Button}
  name="Components/Button"
  props={{ disabled: false, secondary: false }}
  events={['click']}
  layout="centered"
>
  <Tool
    name="Primary with text and icon"
    props={{ text: 'Hello!', icon: 'emoji_people' }}
  />
  <Tool
    name="Primary with text and image icon"
    props={{ text: 'Hello!' }}
    let:props
    let:handleEvent
  >
    <Button {...props} on:click={handleEvent}>
      <GithubLogo slot="icon" /></Button
    >
  </Tool>
  <Tool name="Primary with icon only" props={{ icon: 'videogame_asset' }} />
  <Tool name="Primary image icon only" let:handleEvent>
    <Button on:click={handleEvent}>
      <GithubLogo slot="icon" /></Button
    >
  </Tool>
  <Tool name="Primary with text" props={{ text: 'Hello!' }} />
  <Tool
    name="Secondary with text and icon"
    props={{ secondary: true, text: 'Hello!', icon: 'emoji_people' }}
  />
  <Tool
    name="Secondary with icon only"
    props={{ secondary: true, icon: 'videogame_asset' }}
  />
  <Tool
    name="Secondary with text"
    props={{ secondary: true, text: 'Hello!' }}
  />
  <Tool
    name="With badge"
    props={{ text: 'Inbox', icon: 'email', badge: 5 }}
    let:props
    let:handleEvent
  >
    <div>Vous avez...</div>
    <Button {...props} on:click={handleEvent} />
    <div>Nouveau(x) message(s).</div>
  </Tool>
  <Tool
    name="Transparent with text"
    props={{ transparent: true, text: 'Hello!' }}
  />
</ToolBox>
