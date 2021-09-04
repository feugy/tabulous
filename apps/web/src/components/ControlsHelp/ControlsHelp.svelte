<script>
  import { _ } from 'svelte-intl'
  import Section from './Section.svelte'

  const cameraControls = [
    { actions: ['left-drag', 'pointer-drag'], outcome: 'pan-camera' },
    { actions: ['right-drag', 'two-pointers-drag'], outcome: 'rotate-camera' },
    { actions: ['mouse-wheel', 'pinch'], outcome: 'zoom' },
    { actions: ['new-camera'], outcome: 'save-new-camera' },
    { actions: ['restore-camera'], outcome: 'restore-camera' },
    { actions: ['update-camera'], outcome: 'save-camera' }
  ]
  const objectControls = [
    {
      actions: ['double-left-object', 'two-pointers-object'],
      outcome: 'open-menu'
    },
    { actions: ['long-left-object', 'long-pointer-object'], outcome: 'detail' },
    {
      actions: ['long-left-drag-select', 'long-pointer-drag-select'],
      outcome: 'add-to-selection'
    },
    {
      actions: ['left-outside-selection', 'pointer-outside-selection'],
      outcome: 'clear-selection'
    }
  ]
  const selectionControls = [
    { actions: ['left-drag-object', 'pointer-drag-object'], outcome: 'move' },
    { actions: ['left-object', 'pointer-object'], outcome: 'flip' },
    { actions: ['right-object', 'two-pointers-object'], outcome: 'rotate' }
  ]
</script>

<style type="postcss">
  div {
    @apply flex-1 p-2 h-full overflow-auto;
  }

  section {
    @apply grid flex-1 max-h-full items-center gap-6 p-2;
    grid-template-columns: repeat(auto-fit, minmax(15vw, 1fr));
  }

  h3 {
    @apply text-xl border-solid mx-2 pb-1 pt-4;
    border-bottom-width: 1px;
    border-color: theme('colors.secondary.light');
  }
</style>

<div>
  <h3>{$_('titles.object-controls')}</h3>
  <section>
    {#each objectControls as { actions, outcome }}
      <Section {actions} {outcome} />
    {/each}
  </section>
  <h3>{$_('titles.selection-controls')}</h3>
  <section>
    {#each selectionControls as { actions, outcome }}
      <Section {actions} {outcome} />
    {/each}
  </section>
  <h3>{$_('titles.camera-controls')}</h3>
  <section>
    {#each cameraControls as { actions, outcome }}
      <Section {actions} {outcome} />
    {/each}
  </section>
</div>
