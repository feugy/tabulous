<script>
  import { recordEvent, Tool, ToolBox } from '@atelier-wb/svelte'
  import { Button } from '@src/components'
  import RadialMenu from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/RadialMenu.svelte'

  let open = true
</script>

<ToolBox
  name="Routes/game/[gameId]/Radial Menu"
  props={{ x: '25%', y: '25%', angleShift: Math.PI * -0.5 }}
  events={['click']}
  layout="centered"
>
  <Tool name="No items" props={{ items: [] }} let:props>
    <RadialMenu bind:open {...props} />
    <Button
      on:click={() => {
        open = !open
      }}
      text={open ? 'Close' : 'Open'}
    />
  </Tool>
  <Tool
    name="A few items"
    props={{
      items: [
        { icon: 'home', onClick: () => recordEvent('click', 'home') },
        {
          icon: 'settings',
          secondary: true,
          onClick: () => recordEvent('click', 'settings')
        }
      ]
    }}
    let:props
  >
    <RadialMenu bind:open {...props} />
    <Button
      on:click={() => {
        open = !open
      }}
      text={open ? 'Close' : 'Open'}
    />
  </Tool>
  <Tool
    name="More items"
    props={{
      items: [
        { icon: 'home', onClick: () => recordEvent('click', 'home') },
        {
          icon: 'settings',
          secondary: true,
          onClick: () => recordEvent('click', 'settings')
        },
        {
          icon: 'face',
          secondary: true,
          onClick: () => recordEvent('click', 'face')
        },
        { icon: 'lock', onClick: () => recordEvent('click', 'lock') },
        { icon: 'flip', onClick: () => recordEvent('click', 'flip') },
        { icon: 'shuffle', onClick: () => recordEvent('click', 'shuffle') },
        { icon: 'rotate_left', onClick: () => recordEvent('click', 'rotate') }
      ]
    }}
    let:props
  >
    <RadialMenu bind:open {...props} />
    <Button
      on:click={() => {
        open = !open
      }}
      text={open ? 'Close' : 'Open'}
    />
  </Tool>
</ToolBox>
