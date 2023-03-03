<script>
  import { Aside } from '@src/components'
</script>

<main class="flex w-full h-screen" style="height: 100vh">
  <section class="flex-1" />
  <Aside {...$$restProps} on:sendMessage />
</main>
