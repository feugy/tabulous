<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { Dropdown } from '../../src/components'

  const headerText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Commodo nulla facilisi
nullam vehicula ipsum a arcu cursus. Eget sit amet tellus cras adipiscing
enim eu turpis egestas. Integer malesuada nunc vel risus commodo viverra
maecenas accumsan lacus. Risus viverra adipiscing at in tellus integer
feugiat scelerisque. Ultrices in iaculis nunc sed augue lacus viverra.
Scelerisque in dictum non consectetur a erat nam at lectus. Egestas erat
imperdiet sed euismod nisi porta. Ut faucibus pulvinar elementum integer
enim neque. Proin sed libero enim sed faucibus turpis in eu. A iaculis at
erat pellentesque adipiscing commodo elit at imperdiet.`

  const footerText = `Mus mauris vitae ultricies leo integer malesuada nunc vel risus. Tincidunt
vitae semper quis lectus nulla at. Ac felis donec et odio pellentesque
diam volutpat. Lectus sit amet est placerat in egestas erat. Cursus sit
amet dictum sit amet justo donec. Metus aliquam eleifend mi in nulla
posuere sollicitudin aliquam ultrices. Augue neque gravida in fermentum et
sollicitudin ac orci phasellus. Vel quam elementum pulvinar etiam non quam
lacus. Risus commodo viverra maecenas accumsan lacus vel facilisis
volutpat est. Adipiscing vitae proin sagittis nisl rhoncus mattis.
Vulputate eu scelerisque felis imperdiet proin fermentum. Suspendisse
potenti nullam ac tortor vitae. Sem nulla pharetra diam sit amet. Egestas
pretium aenean pharetra magna ac placerat vestibulum lectus. Ut porttitor
leo a diam sollicitudin tempor id. Eget nullam non nisi est. Ullamcorper a
lacus vestibulum sed arcu non odio euismod lacinia.`
</script>

<ToolBox
  name="Components/Drop down"
  props={{
    disabled: false,
    valueAsText: false,
    withArrow: true,
    openOnClick: true,
    text: 'Greet',
    icon: 'emoji_people',
    options: [
      'Hello! (this is in English)',
      `Salut ! (c'est en français)`,
      'Hallo ! (das ist im Deutsch)'
    ]
  }}
  layout="centered"
>
  <Tool name="Left aligned" let:props let:handleEvent>
    <div>
      <div>{headerText}</div>
      <Dropdown
        {...props}
        on:click={handleEvent}
        on:select={handleEvent}
        on:close={handleEvent}
      />
      <div>{footerText}</div>
    </div>
  </Tool>
  <Tool name="Right aligned" let:props let:handleEvent>
    <div class="text-right">
      <div>{headerText}</div>
      <Dropdown
        {...props}
        on:click={handleEvent}
        on:select={handleEvent}
        on:close={handleEvent}
      />
      <div>{footerText}</div>
    </div>
  </Tool>
  <Tool
    name="Icon only"
    props={{
      text: null,
      icon: 'headset_mic',
      options: [
        { icon: 'play_arrow', label: 'play' },
        { icon: 'stop', label: 'stop' },
        { icon: 'fast_rewind', label: 'previous' },
        { icon: 'fast_forward', label: 'next' }
      ]
    }}
    let:props
    let:handleEvent
  >
    <div>
      <div>{headerText}</div>
      <Dropdown
        {...props}
        on:click={handleEvent}
        on:select={handleEvent}
        on:close={handleEvent}
      />
      <div>{footerText}</div>
    </div>
  </Tool>
  <Tool
    name="Value as text"
    props={{
      text: 'player',
      icon: 'headset_mic',
      valueAsText: true,
      options: [
        { icon: 'play_arrow', label: 'play' },
        { icon: 'stop', label: 'stop' },
        { icon: 'fast_rewind', label: 'previous' },
        { icon: 'fast_forward', label: 'next' }
      ]
    }}
    let:props
    let:handleEvent
  >
    <div>
      <div>{headerText}</div>
      <Dropdown
        {...props}
        on:click={handleEvent}
        on:select={handleEvent}
        on:close={handleEvent}
      />
      <div>{footerText}</div>
    </div>
  </Tool>
  <Tool
    name="Split clicks"
    props={{
      text: null,
      icon: 'headset_mic',
      openOnClick: false,
      options: [
        { icon: 'play_arrow', label: 'play' },
        { icon: 'stop', label: 'stop' },
        { icon: 'fast_rewind', label: 'previous' },
        { icon: 'fast_forward', label: 'next' }
      ]
    }}
    let:props
    let:handleEvent
  >
    <div>
      <div>{headerText}</div>
      <Dropdown
        {...props}
        on:click={handleEvent}
        on:select={handleEvent}
        on:close={handleEvent}
      />
      <div>{footerText}</div>
    </div>
  </Tool>
</ToolBox>
