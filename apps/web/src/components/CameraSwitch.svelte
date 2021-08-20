<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'

  export let saveCount = 1
  export let maxCount = 6

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

<style type="postcss">
</style>

<svelte:window on:click={() => (adding = false)} />

{#each { length: saveCount } as save, index}
  <Button
    icon="videocam"
    badge={index === 0 ? null : index}
    title={$_(adding ? 'tooltips.save-camera' : 'tooltips.restore-camera', {
      index
    })}
    disabled={adding && index === 0}
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
    on:click={handleEnterAdd}
  />
{/if}
