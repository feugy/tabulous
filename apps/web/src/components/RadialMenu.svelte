<script>
  import Button from './Button.svelte'
  export let items = []
  export let open = false
  export let x = 0
  export let y = 0
  export let angleShift = 0.2

  $: left = typeof x === 'number' ? `${x}px` : x
  $: top = typeof y === 'number' ? `${y}px` : y
  $: radius = 12.5 * items.length

  // TODO https://tailwindcss.com/docs/configuration#referencing-in-java-script
  // TODO use css module?
  const enterDuration = 100

  function computeItemPosition({ i }) {
    const angle = (-2 * Math.PI * (1 - i)) / items.length
    // add 1 radius because css origin is menu's top-left corner, not its center
    return {
      x: radius * (Math.cos(angle + angleShift) + 1),
      y: radius * (Math.sin(angle + angleShift) + 1)
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

<style lang="postcss">
  aside {
    @apply absolute rounded-full border-2 flex items-center 
           justify-center border-$primary-light transform-gpu -translate-x-1/2 -translate-y-1/2;
    width: var(--size);
    height: var(--size);
  }

  ul {
    @position relative;
  }

  li {
    @apply absolute opacity-0  transform-gpu -translate-x-1/2 -translate-y-1/2;
    /* align item center on the menu's circle */
  }
</style>

{#if open && items?.length}
  <aside style={`left: ${left}; top: ${top}; --size:${radius * 2}px;`}>
    <ul on:pointerdown|stopPropagation on:mouseenter on:mouseleave>
      {#each items as { onClick, ...buttonProps }, i}
        {#key buttonProps}
          <li
            in:enter={{ i }}
            on:introend={({ target }) => handleEnterEnd({ i, target })}
          >
            <Button {...buttonProps} on:click={onClick} />
          </li>
        {/key}
      {/each}
    </ul>
    <slot />
  </aside>
{/if}
