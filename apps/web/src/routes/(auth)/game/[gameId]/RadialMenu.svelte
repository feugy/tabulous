<script context="module">
  import ms from 'ms'
  import { fade } from 'svelte/transition'

  import { browser } from '$app/environment'

  let enterDuration = 0
  if (browser) {
    enterDuration = ms(
      getComputedStyle(document.querySelector(':root'))
        .getPropertyValue('--short')
        .trim() || '0ms'
    )
  }
</script>

<script>
  import { Button, QuantityButton } from '@src/components'
  import { writable } from 'svelte/store'
  import { _ } from 'svelte-intl'

  export let items = []
  export let open = false
  export let x = 0
  export let y = 0
  export let angleShift = Math.PI * -0.5

  const actions = writable(null)
  $: {
    // make sure we reset actions to trigger animations again.
    actions.set(null)
    if (items) {
      setTimeout(() => actions.set(items), enterDuration)
    }
  }

  $: left = typeof x === 'number' ? `${x}px` : x
  $: top = typeof y === 'number' ? `${y}px` : y
  $: radius = 55 + 5 * $actions?.length

  function computeItemPosition({ i }) {
    const angle = (-2 * Math.PI * ($actions.length - i)) / $actions.length
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

  function hide() {
    return { duration: 0, css: () => 'opacity:0' }
  }

  function handleEnterEnd(args) {
    const { x, y } = computeItemPosition(args)
    args.target.style = `opacity: 1; left: ${x}px; top: ${y}px;`
  }
</script>

{#if open && Array.isArray($actions)}
  <aside
    transition:fade={{ duration: enterDuration }}
    style="left: {left}; top: {top}; --size:{radius * 2}px;"
  >
    {#if $actions?.length === 0}
      <span
        class="no-actions"
        transition:fade={{ duration: enterDuration, delay: enterDuration }}
        >{$_('labels.no-actions')}</span
      >
    {/if}
    <ul on:pointerdown|stopPropagation on:mouseenter on:mouseleave role="menu">
      {#each $actions as { icon, onClick, title, badge, max, ...buttonProps }, i (icon)}
        <li
          in:enter={{ i }}
          on:introend={({ target }) => handleEnterEnd({ i, target })}
          out:hide
        >
          {#if max}
            <QuantityButton
              title={title ? $_(title) : undefined}
              badge={badge ? $_(badge) : undefined}
              {max}
              {icon}
              {...buttonProps}
              on:click={onClick}
            />
          {:else}
            <Button
              title={title ? $_(title) : undefined}
              badge={badge ? $_(badge) : undefined}
              {icon}
              {...buttonProps}
              on:click={onClick}
            />
          {/if}
        </li>
      {/each}
    </ul>
    <slot />
  </aside>
{/if}

<style lang="postcss">
  aside {
    @apply absolute rounded-full border-3 flex items-center z-10
           justify-center border-$base-darker transform-gpu -translate-x-1/2 -translate-y-1/2;
    width: var(--size);
    height: var(--size);
  }

  .no-actions {
    @apply flex rounded-full bg-$base-light items-center text-center w-[80%] h-[80%];
  }

  ul {
    @position relative;
  }

  li {
    /* align item center on the menu's circle */
    @apply absolute opacity-0 transform-gpu -translate-x-1/2 -translate-y-1/2;
  }
</style>
