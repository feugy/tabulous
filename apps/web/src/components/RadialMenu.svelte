<script>
  import { Button } from '.'
  export let items = []
  export let open = false
  export let x = 0
  export let y = 0

  $: left = typeof x === 'number' ? `${x}px` : x
  $: top = typeof y === 'number' ? `${y}px` : y
  $: radius = 12.5 * items.length

  // TODO https://tailwindcss.com/docs/configuration#referencing-in-java-script
  const enterDuration = 150

  function computeItemPosition({ i }) {
    const angle = (-2 * Math.PI * (1 - i)) / items.length
    // add 1 radius because css origin is menu's top-left corner, not its center
    return {
      x: radius * (Math.cos(angle) + 1),
      y: radius * (Math.sin(angle) + 1)
    }
  }

  function enter(node, args) {
    const { x, y } = computeItemPosition(args)
    const oX = radius
    const oY = radius
    return {
      delay: enterDuration * 0.75 * args.i,
      duration: enterDuration,
      css: t =>
        `opacity: ${t};left: ${oX - t * (oX - x)}px; top: ${
          oY - t * (oY - y)
        }px;`
    }
  }

  function handleEnterEnd(args) {
    const { x, y } = computeItemPosition(args)
    args.target.style = `opacity: 1; left: ${x}px; top: ${y}px;`
  }
</script>

<style type="postcss">
  ul {
    @apply absolute rounded-full border-2;
    border-color: theme('colors.primary.light');
    width: var(--size);
    height: var(--size);
    /* align menu center on given coordinates */
    transform: translate(-50%, -50%);
  }

  li {
    @apply absolute;
    opacity: 0;
    /* align item center on the menu's circle */
    transform: translate(-50%, -50%);
  }
</style>

{#if open}
  <ul
    on:pointerdown|stopPropagation
    style={`left: ${left}; top: ${top}; --size:${radius * 2}px;`}
    on:mouseenter
    on:mouseleave
  >
    {#each items as { onClick, ...buttonProps }, i}
      <li
        in:enter={{ i }}
        on:introend={({ target }) => handleEnterEnd({ i, target })}
      >
        <Button {...buttonProps} on:click={onClick} />
      </li>
    {/each}
  </ul>
{/if}
