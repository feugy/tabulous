<script>
  import { Tool } from '@atelier-wb/svelte'
  import { Dialogue } from '@src/components'
</script>

<Tool
  name="Components/Dialogue"
  props={{
    open: true,
    closable: true,
    title: 'Magnifique!'
  }}
  let:props
  let:handleEvent
>
  <main>
    <div>Vous savez quelle différence il y a entre un con et un voleur ?</div>
    <div>Non...</div>
    <div>Un voleur de temps en temps ça se repose.</div>
  </main>
  <Dialogue {...props} on:close={handleEvent} on:open={handleEvent} />
</Tool>
