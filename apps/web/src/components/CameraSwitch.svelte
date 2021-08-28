<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'

  export let current = null
  export let saves = []
  export let maxCount = 6

  $: saveCount = saves.length

  $: isSaved = Boolean(saves.find(({ hash }) => hash === current?.hash))

  // catching clicks on window ensure we leave adding mode wherever user clicks
  // it allows them cancelling the operation
  let adding = false

  const dispatch = createEventDispatcher()

  function handleSaveOrRestore(index) {
    dispatch(adding ? 'save' : 'restore', { index })
  }

  function handleAddSave(index) {
    dispatch('save', { index })
  }

  function handleEnterAdd(event) {
    event.stopPropagation()
    adding = true
  }
</script>

<svelte:window on:click={() => (adding = false)} />

{#each saves as save, index}
  <Button
    icon="videocam"
    badge={index === 0 ? null : index}
    title={$_(adding ? 'tooltips.save-camera' : 'tooltips.restore-camera', {
      index
    })}
    disabled={save.hash === current?.hash}
    on:click={() => handleSaveOrRestore(index)}
  />{' '}
{/each}
{#if adding}
  <Button
    icon="videocam"
    badge={saveCount}
    title={$_('tooltips.save-camera', { index: saveCount })}
    on:click={() => handleAddSave(saveCount)}
  />
{:else if saveCount <= maxCount}
  <Button
    icon="video_call"
    title={$_('tooltips.save-new-camera')}
    disabled={isSaved}
    on:click={handleEnterAdd}
  />
{/if}
