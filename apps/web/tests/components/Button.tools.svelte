<script>
  import { Tool, ToolBox } from '@atelier/svelte'
  import { Button } from '../../src/components'
</script>

<ToolBox component={Button} name="Components/Button" events={['click']}>
  <Tool
    name="Primary with text and icon"
    props={{ text: 'Hello!', icon: 'emoji_people' }}
  />
  <Tool name="Primary with icon only" props={{ icon: 'videogame_asset' }} />
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
</ToolBox>
