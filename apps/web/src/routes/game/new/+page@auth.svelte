<script>
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { createGame } from '../../../stores'

  const gameName = $page.url.searchParams.get('name')

  onMount(async () =>
    goto(gameName ? `/game/${await createGame(gameName)}` : '/', {
      replaceState: true
    })
  )
</script>
