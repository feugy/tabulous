# TODO

## Refactor

- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- disable any possible action while animating

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

- persistant chat
- search by name and id
- indicates when remote stream is muted/stopped

# Known issues

- multi selection does not always work fine
- flip stacked items only flip individual card: it does not change the ordering
- flipping or rotating item does not change vertical position: items above it will still be above it at the end
- moving items bellow other does not apply gravity to them

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

1. player A is already in game, with an open WebSocket connection
1. player B join game
   1. opens a WebSocket connection
   1. creates a WebRTC peer (initiator) and receives an offer signal
   1. send it throught WebSocket to player A
1. player A receives offer through WebSocket
   1. creates a WebRTC peer
   1. uses the offer and receives an answer signal
   1. send it throught WebSocket to player B
1. player B receives answer through WebSocket
   1. uses the answer
1. their duplex connection is established

## Game lifecycle

1. player A calls `createGame(kind)`
1. server creates a game id, loads scene descriptor, adds player A to the player list, returns the game id
1. player A calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player A calls `invite(gameId, playerId)` to invite player B
1. player B calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player B tries to connect with all players already connected (see connection handshake)

## STUN & TURN server `WIP`

```shell
docker run -d --network=host coturn/coturn --external-ip=78.192.173.27 --relay-ip=192.168.1.45 -X -v -u tabulous:soulubat -a -f -r tabulous

```

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

For decent in-game performance, textures must be GPU-compressed to KTX2 container format. This will skip CPU uncompressing jpeg/png content before passing it to the GPU.

```shell
mogrify -flop -strip apps/web/public/images/splendor/1/*.png
for file in apps/web/public/images/splendor/1/*.png; do toktx --uastc 4 ${file/.png/.ktx2} $file; done
```

1. flip image horizontally (front face on the left, back face on the right, mirrored) and strip png ICC profile (ktx2 does not support them)
2. convert to ktx2

There is no built-in way for the remote side of an WebRTC connection to know that video or audio was disabled.
The mute/unmute events are meant for network issues. Stopping a track is definitive. Adding/removing track from stream only works locally (or would trigger re-negociation)

# Source

[Cours complet apprendre K8s](https://devopssec.fr/article/cours-complet-apprendre-orchestrateur-kubernetes-k8s#begin-article-section)
[OVH terraform Kube Provider](https://registry.terraform.io/providers/ovh/ovh/latest/docs)
