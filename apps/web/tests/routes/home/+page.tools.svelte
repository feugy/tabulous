<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import HomePage from '@src/routes/home/+page.svelte'
  import { initGraphQlClient } from '@src/stores'
  import { graphQlUrl } from '@src/utils'
  import { setSvelteUrl } from '@tests/atelier/setup'

  const player = {
    id: 'abc123',
    username: 'Jane Doe',
    termsAccepted: true
  }
  const publicCatalog = [
    {
      name: 'playground',
      locales: { fr: { title: 'Aire de jeu' } },
      minSeats: 2,
      maxSeats: 8
    },
    {
      name: 'draughts',
      locales: { fr: { title: 'Dames' } },
      minAge: 6,
      minTime: 30,
      minSeats: 2,
      maxSeats: 2
    },
    {
      name: 'klondike',
      locales: { fr: { title: 'Solitaire' } },
      minAge: 7,
      minTime: 15,
      minSeats: 1,
      maxSeats: 1
    }
  ]
  const privateCatalog = [
    {
      name: 'dune-imperium',
      locales: { fr: { title: 'Dune Imperium' } },
      minAge: 13,
      minTime: 90,
      minSeats: 1,
      maxSeats: 4,
      copyright: {
        authors: [{ name: 'Paul Dennen' }],
        designers: [
          { name: 'Clay Brooks' },
          { name: 'Nate Storm' },
          { name: 'Raul Ramos' },
          { name: 'Brett Nienburg' },
          { name: 'Atila Guzey' },
          { name: 'Derek Herring' },
          { name: 'Kenan Jackson' }
        ],
        publishers: [
          { name: 'Dire Wolf Digital' },
          { name: 'Gale Force Nine' },
          { name: 'Lucky Duck' },
          { name: 'Legendary' }
        ]
      }
    },
    {
      name: '6-takes',
      locales: { fr: { title: '6 qui prend !' } },
      minAge: 10,
      minTime: 15,
      minSeats: 2,
      maxSeats: 8,
      copyright: {
        authors: [{ name: 'Wolfgang Kramer' }],
        designers: [{ name: 'Franz vohwinkel' }],
        publishers: [{ name: 'Amigo' }, { name: 'Gigamic' }]
      }
    },
    ...publicCatalog
  ]
  const currentGames = [
    {
      id: 'c6fbe808-d23b-43de-8617-8688223155c0',
      created: 1659075476987,
      kind: '6-takes',
      players: [
        { id: '1789', username: 'Dams', playing: false, isGuest: false },
        player,
        { id: '8850', username: 'Célia', playing: false, isGuest: false },
        { id: '3432', username: 'Hugo', playing: false, isGuest: true }
      ],
      locales: { fr: { title: '6 qui prend !' } }
    },
    {
      id: 'b9c5b5e7-1ab2-4849-8490-fa13dcd0840e',
      created: 1659424383964,
      kind: 'playground',
      players: [{ ...player, isOwner: true }],
      locales: { fr: { title: 'Jeu de 32 cartes' } }
    }
  ]
  const friends = [
    { player: { id: 'bcd234', username: 'Karl L.' }, isRequest: true }
  ]
</script>

<ToolBox
  component={HomePage}
  name="Routes/home"
  setup={() => setSvelteUrl('/home')}
>
  <Tool name="Anonymous" props={{ data: { catalog: publicCatalog } }} />
  <Tool
    name="Authenticated"
    props={{
      data: {
        session: { player },
        currentGames,
        catalog: privateCatalog
      }
    }}
    setup={() => {
      const client = initGraphQlClient({
        graphQlUrl,
        subscriptionSupport: false
      })
      client.query = () => ({
        toPromise: async () => ({ data: { doesNotMatter: friends } })
      })
    }}
  />
</ToolBox>
