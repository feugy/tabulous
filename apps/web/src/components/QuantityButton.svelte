<script>
  // @ts-check
  import { createEventDispatcher } from 'svelte'

  import Button from './Button.svelte'

  /** @type {boolean} whether this button is primary or base. */
  export let primary = false
  /** @type {boolean} whether this button is disabled. */
  export let disabled = false
  /** @type {number} the current quantity displayed. */
  export let quantity = 1
  /** @type {number} maximum quantity allowed. */
  export let max = 1000

  /** @type {import('svelte').EventDispatcher<{ click: { quantity: number } }>} */
  const dispatch = createEventDispatcher()

  function stepUp() {
    if (quantity < max) {
      quantity++
    } else {
      quantity = 1
    }
  }

  function stepDown() {
    if (quantity > 1) {
      quantity--
    } else {
      quantity = max
    }
  }

  function handleUp(/** @type {MouseEvent} */ event) {
    event.stopPropagation()
    stepUp()
  }

  function handleDown(/** @type {MouseEvent} */ event) {
    event.stopPropagation()
    stepDown()
  }

  function handleKeys(/** @type {KeyboardEvent} */ event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'ArrowRight':
        stepUp()
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        stepDown()
        break
      case 'Home':
        quantity = 1
        break
      case 'End':
        quantity = max
        break
    }
  }

  function handleClick(/** @type {MouseEvent} */ event) {
    event.stopPropagation()
    dispatch('click', { quantity })
  }
</script>

<span
  role="slider"
  aria-valuenow={quantity}
  tabindex={-1}
  on:keyup|stopPropagation={handleKeys}
>
  <Button
    {...$$restProps}
    {disabled}
    {primary}
    on:click={handleClick}
    on:pointerdown
    on:pointerup
  >
    <strong>{quantity}</strong></Button
  >
  <div>
    <Button
      data-up
      icon="arrow_drop_up"
      {disabled}
      {primary}
      on:click={handleUp}
    />
    <Button
      data-down
      icon="arrow_drop_down"
      {disabled}
      {primary}
      on:click={handleDown}
    />
  </div>
</span>

<style lang="postcss">
  span {
    @apply relative inline-flex items-center justify-center;
    --shadow-drop: 0 3px;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--secondary-darker)
    );

    & > :global(button:first-child) {
      @apply z-1;
    }

    & :global(button) {
      filter: none !important;
    }
  }

  strong {
    @apply font-normal pl-2;
    line-height: 2rem;
  }

  div {
    @apply flex flex-col -ml-4;

    & :global(.material-icons) {
      font-size: 20px;
    }
    & > :global(button[data-up]) {
      @apply rounded-none !important;
      border-top-right-radius: 9999px !important;
    }
    & > :global(button[data-down]) {
      @apply border-t border-$ink-dark rounded-none !important;
      border-bottom-right-radius: 9999px !important;
    }
    & > :global(button > div) {
      @apply text-$ink-dark;
      padding: 0 0.75rem 0 1.25rem !important;
    }
    & > :global(button::before) {
      @apply hidden;
    }

    & > :global(button:not([disabled])) {
      @apply bg-$secondary-dark;
    }
    & > :global(button:not([disabled]):hover) {
      @apply bg-$secondary-darker;
    }
    & > :global(button:not([disabled]):focus) {
      @apply bg-$secondary-darker;
    }
    & > :global(button.primary:not([disabled])) {
      @apply bg-$primary-dark !important;
    }
    & > :global(button.primary:not([disabled]):hover) {
      @apply bg-$primary-darker !important;
    }
    & > :global(button.primary:not([disabled]):focus) {
      @apply bg-$primary-darker !important;
    }
  }
</style>
