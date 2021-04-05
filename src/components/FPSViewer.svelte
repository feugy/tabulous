<script>
  import { fps } from '../stores'
</script>

<style type="postcss">
  div {
    @apply absolute z-10 block bg-white;
    right: 5px;
    top: 5px;
    padding: 0.5rem;
  }
</style>

<div>FPS: {$fps}</div>
