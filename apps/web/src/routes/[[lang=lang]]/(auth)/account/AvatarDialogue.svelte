<script>
  // @ts-check
  import { ConfirmDialogue, Input } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  /** @type {boolean} whether this dialogue is opened. */
  export let open
  /** @type {string | undefined} entered avatar value. */
  export let avatar

  const dispatch = createEventDispatcher()

  function handleKey(/** @type {KeyboardEvent} */ event) {
    if (event.key === 'Enter') {
      dispatch('close', true)
      open = false
    }
  }
</script>

<ConfirmDialogue
  on:close
  bind:open
  title={$_('titles.change-avatar')}
  confirmText={$_('actions.save')}
  cancelText={$_('actions.back')}
>
  <Input
    bind:value={avatar}
    placeholder={$_('placeholders.avatar')}
    on:keyup={handleKey}
  />
  <span>{$_('tooltips.change-avatar')}</span>
</ConfirmDialogue>

<style lang="postcss">
  span {
    @apply text-xs;
  }
</style>
