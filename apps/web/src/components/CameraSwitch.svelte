<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'

  export let current = null
  export let saves = []
  export let maxCount = 9
  export let longTapDelay = 250

  const timeByPointerId = new Map()
  let deferLong

  $: saveCount = saves.length

  $: isSaved = Boolean(saves.find(({ hash }) => hash === current?.hash))

  const dispatch = createEventDispatcher()

  function handleDown(pointerId) {
    timeByPointerId.set(pointerId, Date.now())
    deferLong = setTimeout(() => dispatch('longTap'), longTapDelay)
  }

  function handleUp(pointerId, index) {
    clearTimeout(deferLong)
    const start = timeByPointerId.get(pointerId)
    if (start) {
      if (Date.now() - start < longTapDelay) {
        dispatch('restore', { index })
      } else if (index !== 0) {
        dispatch('save', { index })
      }
    }
    timeByPointerId.clear()
  }
</script>

{#each saves as save, index}
  <Button
    icon="videocam"
    badge={index === 0 ? null : index}
    title={$_('tooltips.save-restore-camera', { index })}
    disabled={save.hash === current?.hash}
    on:pointerdown={({ pointerId }) => handleDown(pointerId)}
    on:pointerup={({ pointerId }) => handleUp(pointerId, index)}
  />{' '}
{/each}
{#if saveCount <= maxCount}
  <Button
    icon="video_call"
    title={$_('tooltips.save-new-camera')}
    disabled={isSaved}
    on:click={() => dispatch('save', { index: saveCount })}
  />
{/if}
