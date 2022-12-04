<script>
  import { Tool, ToolBox } from '@atelier-wb/svelte'
  import Parameters from '@src/routes/(auth)/game/[gameId]/Parameters'
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
                name: 'Couleur',
                white: 'Blancs',
                black: 'Noirs'
              }
            }
          },
          position: {
            enum: ['top', 'left', 'right', 'bottom'],
            metadata: {
              fr: {
                name: 'Position',
                top: 'Haut',
                left: 'Gauche'
              }
            }
          }
        }
      }
    }}
  />
</ToolBox>
