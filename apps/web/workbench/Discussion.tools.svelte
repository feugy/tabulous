<script>
  import { Tool } from '@tabulous/workbench/src/workbench'
  import Discussion from '../src/components/Discussion.svelte'
</script>

<Tool name="Components/Discussion/With long thread">
  <Discussion
    thread={[
      { peer: 'Fernand Naudin', message: `Qu'est-ce qui se passe encore ?` },
      {
        peer: 'Maître Folage',
        message: `Notre ami va se faire un plaisir de vous l'expliquer.`
      },
      {
        peer: 'Pascal',
        message: `Les Volfoni ont organisé à la péniche une petite réunion des cadres, façon meeting, si vous voyez ce que je veux dire.
  M'enfin quoi, on parle dans votre dos.`
      },
      { peer: 'Fernand Naudin', message: `Et tu tiens ça d'où ?` },
      {
        peer: 'Pascal',
        message: `Je ne peux pas le dire, j'ai promis. Ce serait mal.`
      },
      { peer: 'Fernand Naudin', message: 'Alors ?' },
      {
        peer: 'Maître Folage',
        message: `Eh bien. Euh. Y'a deux solutions : ou on se dérange, ou on méprise. 
  Oui, évidemment, n'importe comment une tournée d'inspection peut jamais nuire, bien sûr.`
      },
      { peer: 'Fernand Naudin', message: 'Bon, on va y aller, hmm ?' },
      {
        peer: 'Pascal',
        message: `Monsieur Fernand, y'a peut-être une place pour moi dans votre auto. Des fois que la réunion devienne houleuse ... J'ai une présence tranquillisante.`
      }
    ]}
  />
</Tool>

<Tool name="Components/Discussion/With short thread">
  <Discussion thread={[{ peer: 'test', message: 'Aww yeah!!' }]} />
</Tool>
