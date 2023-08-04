<script>
  // @ts-check
  /**
   * @typedef {import('@src/3d/managers/camera').CameraPosition} CameraPosition
   */

  import { Button } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  /** @type {?CameraPosition} current camera position. */
  export let current = null
  /** @type {CameraPosition[]} all saved camera positions. */
  export let saves = []
  /** @type {number} maximum number of saveable positions. */
  export let maxCount = 9
  /** @type {number} number of milliseconds to hold pointer down before it is considered as long. */
  export let longTapDelay = 250

  /** @type {Map<number, number>} */
  const timeByPointerId = new Map()
  /** @type {ReturnType<setTimeout>} */
  let deferLong

  $: saveCount = saves.length

  $: isSaved = Boolean(saves.find(({ hash }) => hash === current?.hash))

  /** @type {import('svelte').EventDispatcher<{ restore: { index: number }, save: { index: number }, longTap: PointerEvent }>}*/
  const dispatch = createEventDispatcher()

  function handleDown(/** @type {PointerEvent} */ event) {
    timeByPointerId.set(event.pointerId, Date.now())
    deferLong = setTimeout(() => dispatch('longTap', event), longTapDelay)
  }

  function handleUp(
    /** @type {number} */ pointerId,
    /** @type {number} */ index
  ) {
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
    transparent
    on:pointerdown={event => handleDown(event)}
    on:pointerup={({ pointerId }) => handleUp(pointerId, index)}
  />{' '}
{/each}
{#if saveCount <= maxCount}
  <Button
    icon="video_call"
    title={$_('tooltips.save-new-camera')}
    disabled={isSaved}
    transparent
    on:click={() => dispatch('save', { index: saveCount })}
  />
{/if}
