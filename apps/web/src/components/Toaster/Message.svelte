<script>
  import Button from '../Button.svelte'

  export let icon = ''
  export let content = ''
  export let duration = 5
  export let color = '#fcfcfc'

  let hide = false
</script>

<div
  class:hide
  style="--bg-color:{color}; --duration:{duration}s; --close-duration:{duration /
    10}s"
>
  <span class="material-icons">{icon}</span>
  <strong>{content}</strong>
  <Button transparent={true} icon="close" on:click={() => (hide = true)} />
</div>

<style lang="postcss">
  div {
    @apply transform-gpu opacity-0 p-4 shadow-md flex items-center;
    background-color: var(--bg-color);
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
