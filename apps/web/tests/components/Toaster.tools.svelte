<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import { faker } from '@faker-js/faker'
  
  import { Button, Toaster } from '../../src/components'

  let messages = []
  const icons = [
    'build',
    'adjust',
    'attach_file',
    'bookmark',
    'beach_access',
    'brush'
  ]

  const colors = ['#d6a63d', '#41d26d', '#ffa280', undefined, undefined]

  function addToast() {
    messages = [
      ...messages,
      {
        icon: icons[Math.floor(Math.random() * icons.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        content: faker.lorem.words()
      }
    ]
  }
</script>

<ToolBox component={Toaster} name="Components/Toaster" layout="centered">
  <Tool name="Interactive" let:props>
    <Toaster bind:messages {...props} />
    <Button on:click={addToast}>Add toast</Button>
  </Tool>
  <Tool
    name="Text only"
    props={{ messages: [{ content: 'simple message' }] }}
  />
  <Tool
    name="Text, color and icon"
    props={{
      messages: [
        {
          icon: icons[4],
          color: colors[1],
          content: 'message with color and icon'
        }
      ]
    }}
  />
</ToolBox>
