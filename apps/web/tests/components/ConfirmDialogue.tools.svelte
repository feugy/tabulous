<script>
  import { Tool } from '@atelier-wb/svelte'
  import { ConfirmDialogue } from '../../src/components'
</script>

<Tool
  component={ConfirmDialogue}
  name="Components/Confirm Dialogue"
  props={{
    open: true,
    closable: true,
    message: `Vous avez beau dire, y'a pas seulement que de la pomme, y'a autre chose, ce 
serait pas des fois de la betterave ? Hein ?`,
    title: 'Ils boivent'
  }}
  events={['close', 'open']}
>
  <dl slot="header">
    <dt>Raoul Wolfoni</dt>
    <dd>Faut reconnaître, c'est du brutal !</dd>
    <dt>Paul Wolfoni</dt>
    <dd>Vous avez raison, il est curieux hein ?</dd>
    <dt>Mr Fernand</dt>
    <dd>
      J'ai connu une polonaise qu'en prenait au petit déjeuner. Faut quand même
      admettre que c'est plutôt une boisson d'homme.
    </dd>
    <dt>Raoul Wolfoni</dt>
    <dd>
      Tu sais pas ce qu'il me rappelle ? C't'espèce de drôlerie qu'on buvait
      dans une petite taule de bien ho har pas tellement loin de saigon. Les
      volets rouges et la taulière, une blonde komac. Comment qu'elle s'appelait
      non de dieu ?
    </dd>
    <dt>Mr Fernand</dt>
    <dd>Lulu la nantaise.</dd>
  </dl>
</Tool>
