<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import Parameters from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/Parameters'
</script>

<ToolBox
  name="Routes/game/[gameId]/Parameters"
  events={['submit']}
  layout="centered"
>
  <Tool
    component={Parameters}
    name="Single choice"
    props={{
      schema: {
        properties: {
          side: {
            enum: ['black', 'white'],
            description: 'color',
            metadata: {
              fr: {
                name: 'Couleur',
                white: 'Blancs',
                black: 'Noirs'
              }
            }
          }
        }
      }
    }}
  />
  <Tool
    component={Parameters}
    name="Multiple choices"
    props={{
      schema: {
        properties: {
          side: {
            enum: ['black', 'white'],
            metadata: {
              fr: {
                name: 'Couleur'
              }
            }
          },
          position: {
            enum: ['clubs', 'diamonds', 'spades', 'hearts'],
            metadata: {
              fr: {
                name: 'Suite',
                clubs: 'Trèfle',
                diamonds: 'Carreau',
                spades: 'Pique',
                hearts: 'Coeur'
              },
              images: {
                clubs: '/assets/images/clubs-1.1.svg',
                spades: '/assets/images/spades-1.1.svg',
                hearts: '/assets/images/hearts-1.1.svg'
              }
            }
          }
        }
      }
    }}
  />
</ToolBox>
