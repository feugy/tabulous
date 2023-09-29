<script>
  // @ts-check
  import { onMount } from 'svelte'

  import Button from '../Button.svelte'

  /** @type {import('@src/stores').Toast} message content. */
  export let toast

  const defaultColor = '#fcfcfc'
  const defaultDuration = 5

  let hide = false
  /** @type {?HTMLDivElement} */
  let node
  // use absolute positioning to avoid multiple notification glitch:
  // when previous message is removed, next messages "jump" upward because
  // or parent re-layout. Absolute position keep them in place
  let top = 0

  onMount(() => {
    // find nearest visible sibling and position current message bellow
    for (
      let previous = /** @type {?HTMLElement} */ (node?.previousElementSibling);
      previous;
      previous = /** @type {?HTMLElement} */ (previous.previousElementSibling)
    ) {
      const styles = getComputedStyle(previous)
      if (styles.opacity !== '0') {
        const previousOffset = parseInt(styles.top)
        top = previousOffset + previous.offsetHeight
        break
      }
    }
  })
</script>

<div
  class:hide
  bind:this={node}
  style="--top:{top}px; --bg-color:{toast.color ??
    defaultColor}; --duration:{toast.duration ??
    defaultDuration}s; --close-duration:{(toast.duration ?? defaultDuration) /
    10}s"
>
  {#if toast.icon}<span class="material-icons">{toast.icon}</span>{/if}
  <strong>{toast.content}</strong>
  <Button transparent={true} icon="close" on:click={() => (hide = true)} />
</div>

<style lang="postcss">
  div {
    @apply absolute transform-gpu opacity-0 py-2 px-3 shadow-md flex items-center rounded;
    background-color: var(--bg-color);
    top: var(--top);
    animation: showAndHide var(--duration) cubic-bezier(0, 0, 0.2, 1.5);

    &.hide {
      animation: hide var(--close-duration) cubic-bezier(0, 0, 0.2, 1.5);
    }
  }

  strong {
    @apply px-4 font-normal;
  }

  .material-icons {
    font-size: 30px;
  }

  @keyframes showAndHide {
    0% {
      transform: translateY(100%);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      transform: translateY(0%);
      opacity: 1;
    }
    100% {
      transform: translateY(-200%);
      opacity: 0;
    }
  }

  @keyframes hide {
    0% {
      opacity: 1;
    }
    100% {
      transform: translateY(-200%);
      opacity: 0;
    }
  }
</style>
