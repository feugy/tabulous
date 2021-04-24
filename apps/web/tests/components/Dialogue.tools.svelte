<script>
  import { Tool } from '@atelier/svelte'
  import { Dialogue } from '../../src/components'
</script>

<Tool
  component={Dialogue}
  name="Components/Dialogue"
  props={{
    open: true,
    closable: true,
    title: 'Magnique!'
  }}
  events={['close', 'open']}
>
  <main slot="header">
    <div>Vous savez quelle différence il y a entre un con et un voleur ?</div>
    <div>Non...</div>
    <div>Un voleur de temps en temps ça se repose.</div>
  </main>
</Tool>
