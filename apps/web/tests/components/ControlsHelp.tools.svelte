<script>
  import { Tool } from '@atelier-wb/svelte'
  import { actionNames, buttonIds } from '@src/3d/utils'
  import { ControlsHelp } from '@src/components'
  import { _ } from 'svelte-intl'
</script>

<Tool
  component={ControlsHelp}
  name="Components/Controls Help"
  props={{
    actionNamesByButton: new Map([
      [buttonIds.button1, [actionNames.flip]],
      [buttonIds.button2, [actionNames.detail]],
      [buttonIds.button3, [actionNames.rotate]]
    ]),
    actionNamesByKey: new Map([
      [$_('shortcuts.flip'), [actionNames.flip]],
      [$_('shortcuts.rotate'), [actionNames.rotate]],
      [$_('shortcuts.toggleLock'), [actionNames.toggleLock]],
      [$_('shortcuts.draw'), [actionNames.draw]],
      [$_('shortcuts.reorder'), [actionNames.reorder]],
      [$_('shortcuts.push'), [actionNames.push, actionNames.increment]],
      [$_('shortcuts.pop'), [actionNames.pop, actionNames.decrement]],
      [$_('shortcuts.random'), [actionNames.random]],
      [$_('shortcuts.setFace'), [actionNames.setFace]],
      [$_('shortcuts.detail'), [actionNames.detail]]
    ])
  }}
/>
