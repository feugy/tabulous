<script>
  import Button from './Button.svelte'

  export let secondary = false
  export let disabled = false
  export let quantity = 1
  export let max = 1000

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
</script>

<style lang="postcss">
  span {
    @apply inline-flex items-center justify-center;

    & > :global(button:first-child) {
      @apply pr-1 rounded-r-none;
    }
  }

  strong {
    @apply font-normal pl-3;
    line-height: 2rem;
  }

  div {
    & > :global(button[data-up]) {
      @apply py-0 px-2 rounded-l-none rounded-br-none;
    }
    & > :global(button[data-down]) {
      @apply py-0 px-2 rounded-l-none rounded-tr-none;
    }
  }
</style>

<span role="slider" on:keyup|stopPropagation={handleKeys}>
  <Button
    {...$$restProps}
    {disabled}
    {secondary}
    on:click
    on:pointerdown
    on:pointerup
  >
    <strong>{quantity}</strong></Button
  >
  <div>
    <Button
      data-up
      icon="keyboard_arrow_up"
      {disabled}
      {secondary}
      on:click={handleUp}
    />
    <Button
      data-down
      icon="keyboard_arrow_down"
      {disabled}
      {secondary}
      on:click={handleDown}
    />
  </div>
</span>
