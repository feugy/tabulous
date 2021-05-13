# TODO

## Tests

- Login route
  - displays login form
  - can not authenticate without username
  - authenticates and navigates to home
- Home route
  - creates new game
  - opens join game dialogue
- JoinGameDialogue component
  - can not join game without game Id
  - displays loader and joins game
  - displays loader and show error

## Refactor

- [ ] UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- [ ] disable any possible action while animating

## Single player

- ust CTRL for changing multiple selection
- parametrize and serialize UVs
- ability to shuffle stack on scene loading
- camera controls
- zoom on item
- permanently shows stack size?
- stack actions:
  - draw multiple cards (either in hand, or in front of them)
  - distribute multiple cards to players (either in their hand, or in front of them)
  - add to bottom
- boards
- player's hand

## Multi player

- inline video

# Known issues

- single source of truth multiplayer mode!
- multi selection does not always work fine
- flip stacked items only flip individual card: it does not change the ordering
- flipping or rotating item does not change vertical position: items above it will still be above it at the end
- moving items bellow other does not apply gravity to them
- some actions are lost over the wire, or not applied, like quick multiple rotations
- need to synchronise actions over the wire (like flipping overlapping cards)
- peer pointer remains after peer is gone
- build doesn't load game's JSON

# Notes

In Tabletopia, the interaction model is:

- left drag the board to pan
- right drag the board to control camera angle
- molette to zoom in and out
- left drag an item to move (clear previous selection unless clicking a selected item)
- left left click to select (clear previous selection)
- double click to zoom (only on cards)
- right click to display action menu (clear previous selection unless clicking a selected item)
- drag + left click to select multiple
- shift + left click to add (or remove) to the multiple selection
- keyboard shortcut to trigger actions on current selection

Being forced to do click (either select or menu) before triggering actions (shortcut or menu) is a bummer

Game setup

- min/max number of players allowed
- players' positions
- token/card enabled behaviors (overall+per item setting?)
- personnal hand support (impact on the draw and distribute commands)

Ideas for UI:

- top right, an help button with drawing for base commands (pan, camera, DnD, main actions)
- top right, an link to the rule book, opened in a floating pane, either taking whole screen, or a third of it
- top left, in a column, player avatars/videos, with number of tokens/cards in hand, and mute indicator & command
- bottom left, chat window
- bottom, expansible area showing player's hand

Ideas for joining a game:

- any player can mute, or kick, another player (really?)

# Multi-player

## WebRTC Connection handshake

1. player A comes first
   1. it opens an initiator peer, generating its offer
   1. it registers its offer into the signaling server
1. player B connects with A, from its ID
   1. it opens a receiver peer
   1. it gets from signaling server player A's offer from its ID
   1. it sends player A's offer through its peer, and generates its answer
   1. it registers its answer into the signaling server
   1. signaling server sends the answer to player A
   1. player A's sends player B's answer through its peer
   1. connection is now complete

## Game lifecycle

1. player A calls `createGame(kind)`
1. server creates a game id, loads scene descriptor, adds player A to the player list, returns the game id
1. player A calls `loadGame(id)` and becomes an initiator peer
1. server returns the game scene descriptor and player list
1. player A tries to connect with other players (no-op)
1. since his the only player, A becomes host
1. (optional) player B wants to join game, player A allows it
1. player B calls `loadGame(id)` and becomes an initiator peer
1. server returns the game scene descriptor and player list
1. player B tries to connect with other players
1. player A will accept the connection

## The host role

The host player is in charge of:

1. be the source of thruth
1. sending an updated game descriptor to new peers
1. storing the game descriptor locally and/or on server

When the host player disconnects, a new host is elected: the first connected player in the game player list becomes host

# Various learnings

Physics engine aren't great: they are all pretty deprecated. [Cannon-es can not be used yet](https://github.com/BabylonJS/Babylon.js/issues/9810).
When stacked, card are always bouncing.

Polygon extrusion does not support path (for curves like rounded corners), and the resulting mesh is not vertically (Y axis) centered

`@storybook/addon-svelte-csf` doesn't work yet with storybook's webpack5 builder. What a pity...

Setting package's type to "module" is not possible, because `snowpack.config.js` would become an ESM module. Since it's using `require()` to load `svelte.config.js` it can not be a module.
Besides, Jest built-in support for modules [is still in progress](https://github.com/facebook/jest/issues/9430).

@web/test-runner, which is snowpack's recommendation, is not at the level of Jest. Running actual browsers to run test is an interesting idea (although it complexifies CI setup).
Chai is a good replacement for Jest's expect, and using mocha instead of Jasmine is a no-brainer.
However, two blockers appeared: Sinon can not mock entire dependencies (maybe an equivvalent rewire would), making mocking extremely hard, and @web/test-runner runs mocha in the browser, preventing to have an global setup script (mocha's --require option)

Removing server to only allow peer communication is really hard:

- a server is needed for peers to exchange webRTC offers and answers, when connecting for the first time, and when reconnecting
- when host player is offline, a server is needed to give the new host all the required data

GraphQL subscriptions are good replacement to WebSockets for implementing the WebRTC signaling server.
However, for scalabily and resilliency reasons, I prefer keeping the signaling server independant from the main server.
