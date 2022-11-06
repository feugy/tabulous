<script>
  import { createEventDispatcher } from 'svelte'

  import Button from './Button.svelte'

  export let secondary = false
  export let disabled = false
  export let quantity = 1
  export let max = 1000

  const dispatch = createEventDispatcher()

  function stepUp() {
    if (quantity < max) {
      quantity++
    }
  }

  function stepDown() {
    if (quantity > 1) {
      quantity--
    }
  }

  function handleUp(event) {
    event.stopPropagation()
    stepUp()
  }

  function handleDown(event) {
    event.stopPropagation()
    stepDown()
  }

  function handleKeys(event) {
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

  function handleClick(event) {
    event.stopPropagation()
    dispatch('click', { quantity })
  }
</script>

<span
  role="slider"
  aria-valuenow={quantity}
  on:keyup|stopPropagation={handleKeys}
>
  <Button
    {...$$restProps}
    {disabled}
    {secondary}
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
      {secondary}
      on:click={handleUp}
    />
    <Button
      data-down
      icon="arrow_drop_down"
      {disabled}
      {secondary}
      on:click={handleDown}
    />
  </div>
</span>

<style lang="postcss">
  span {
    @apply inline-flex items-center justify-center;

    & > :global(button:first-child) {
      @apply pr-1 pl-3 rounded-r-none;
    }
  }

  strong {
    @apply font-normal pl-2;
    line-height: 2rem;
  }

  div {
    @apply flex flex-col;

    & :global(.material-icons) {
      font-size: 20px;
    }
    & > :global(button[data-up]) {
      @apply pt-1 pb-0 pl-1 pr-2 rounded-l-none rounded-br-none;
    }
    & > :global(button[data-down]) {
      @apply pt-0 pb-1 pl-1 pr-2 rounded-l-none rounded-tr-none;
    }
  }
</style>
