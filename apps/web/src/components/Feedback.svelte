<script>
  export let icon = ''
  export let content = ''
  export let color = '#ffffff'
  export let screenPosition = { x: 0, y: 0 }
</script>

<div
  style="top: {screenPosition.y}px; left: {screenPosition.x}px; --color:{color}"
>
  <span class="material-icons">{icon}</span>{content}
</div>

<style lang="postcss">
  div {
    @apply absolute transform-gpu pointer-events-none opacity-0 z-20 text-xl font-extrabold;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1.5);
    color: var(--color);
    -webkit-text-stroke: 1px var(--primary);
  }

  .material-icons {
    font-size: 30px;
  }

  @keyframes ping {
    0% {
      transform: translateY(-100%) translateX(-50%);
      opacity: 0;
    }
    75% {
      transform: translateY(-200%) translateX(-50%);
      opacity: 1;
    }
    100% {
      transform: translateY(-300%) translateX(-50%);
      opacity: 0;
    }
  }
</style>
