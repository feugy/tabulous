# TODO

## Brittle tests

- `InputManager › given an initialized manager() › handles multiple pointers taps`

  > `expect(received).toHaveLength(expected)` line 1319 (1 long received)

- `Dropdown component › given textual options › closes menu on click`

  > `expect(received).toBeNull()` line 115 (menu does exist)

- `Typeahead component › given object options › closes menu with keyboard and opens on focus`

  > `expect(received).toBeNull()` line 126 (menu does exist)

## Refactor

- create Animation objects as part of runAnimation() (constant frameRate of 60)
- do we need to wrap card planes in an invisible box?
- custom message on jest expect (game-interaction)
- jest matchers with mesh (toHaveBeenCalledWith, toHaveBeenNthCalledWith)
- rework target detection. Instead of using real mesh and rays use shapes overlap: each zone is a rectangle/circle on XZ plane, and the moved mesh another rectangle/circle. Check the center of the moved mesh
- all manager managing a collection of behaviors should check their capabilities
- game-manager is just a gigantic mess!!! no single responsibility, global state all over the place
- game-interaction drag-related unit tests
- component, connected-component and routes rendering tests
- get rid of Babylon input management
- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- stackable duration override's movable duration on

## UI

- issue: when playing multiple hand meshes with the action menu, they are dropped at the same coordinates
- multiple stack actions (draw, flip, rotate)
- issue: on a stack, N-1th mesh is interactible (flip/rotate) while Nth mesh is animating (flip)
- display peer's name when running draw animations + show peer avatar/name instead of pointer
- configurable player position at game level
- sort and filter catalog on game names
- feedback on stacking
- stack actions:
  - draw multiple cards (either in hand, or in front of them)
  - distribute multiple cards to players (either in their hand, or in front of them)
  - put/draw under
- keyboard
- indicates when remote stream is muted/stopped
- zoom in/out on rules
- issue: on a game with no textures, loading UI never disappears (and game manager never enables) as onDataLoadedObservable is not triggered

## Server

- use JWT as authentication token (stores player id and username)
- allows a single connection per player (discards other JWTs)
- logging (warning on invalid descriptors)

## Hosting

- where to store secrets?
- use an env file
- deploy in a folder named after the commit SHA
- use symlink to switch between deployments (including conf files)
- rotates log files
- notifies on deployment failures/success
- automate SSH renewal with certbot

# Known issues

- moving items bellow other does not apply gravity to them
- on vite reload, all players could become hosts or peers simultaneously

# Network

- SFR + proxy boulot Lionel: WebRTC failed
- SFR Lionel: WebRTC failed
- Bouyges téléphone Lionel: WebRTC failed

```
{
   "from": "4717",
   "type": "candidate",
   "signal": "{\"type\":\"candidate\",\"candidate\":{\"candidate\":\"candidate:640089829 1 udp 2122260223 192.168.43.213 48168 typ host generation 0 ufrag +Y+q network-id 1 network-cost 10\",\"sdpMLineIndex\":0,\"sdpMid\":\"0\"}}",
   "channels": {}
}
no peer found for signal from 4717
```

# Ideas

## Game setup

- min/max number of players allowed
- players' positions

## Game UI:

- visual hint when receiving messages on collapsed section
- show contextual help (for example, on hover) to indicates which commands are available

# Interaction model

| Action on table  | Tabulous                           | Tabletopia                        |
| ---------------- | ---------------------------------- | --------------------------------- |
| zoom camera      | molette, pinch                     | molette, +/-                      |
| move camera      | left drag, 1 finger drag           | left drag, W/A/S/D                |
| rotate camera    | right drag, 2 fingers drag         | right drag                        |
| multiple select  | long left drag, long 1 finger drag | Shift+left click, Shift+left drag |
| fullscreen       | _button_                           | ~/esc                             |
| save camera      | _button_                           | shift+number, _menu action_       |
| restore camera   | _button_                           | number, _menu action_             |
| menu             | _N/A_                              | right click                       |
| toggle hand      | _N/A_                              | _menu action_                     |
| toggle interface | _N/A_                              | _menu action_                     |
| help             | _N/A_                              | F1, _button_, _menu action_       |
| magnify          | _N/A_                              | Z, _menu action_                  |

| Action on Mesh | Tabulous                                  | Tabletopia                                       |
| -------------- | ----------------------------------------- | ------------------------------------------------ |
| move           | left drag, 1 finger drag                  | left drag                                        |
| select         | _N/A_                                     | left click                                       |
| menu           | double left click, double tap             | right click                                      |
| view details   | long left click, long tap, _menu action_  | double left click                                |
| flip           | left click, 1 finger tap, _menu action_   | F, _menu action_                                 |
| rotate         | right click, 2 fingers tap, _menu action_ | Ctrl+left drag, Q/E/PgUp/PgDown, _menu action_   |
| (un)lock       | _N/A_                                     | L, _menu action_                                 |
| put under      | _N/A_                                     | U, _menu action_                                 |
| take to hand   | _N/A_                                     | T, _move to screen bottom_, _menu action (draw)_ |

| Action on Stacks    | Tabulous      | Tabletopia                              |
| ------------------- | ------------- | --------------------------------------- |
| shuffle             | _menu action_ | _menu action_                           |
| select N to hand    | _N/A_         | molette+left drag, _menu action (take)_ |
| deal N              | _N/A_         | molette+left drag, _menu action (deal)_ |
| stack on top        | _move over_   | _move over_                             |
| stack at the bottom | _N/A_         | Shift+_move over_                       |

In Tabletopia, being forced to do click (either select or menu) before triggering actions (shortcut or menu) is a bummer.
They support keyboard, but not fingers.

# Game lifecycle

1. player A calls `createGame(kind)`
1. server creates a game id, loads scene descriptor, adds player A to the player list, returns the game id
1. player A calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player A calls `invite(gameId, playerId)` to invite player B
1. player B calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player B tries to connect with all players already connected (see connection handshake)

## The host role

The host player is in charge of:

1. be the source of thruth
1. sending an updated game descriptor to new peers
1. storing the game descriptor locally and/or on server
1. regularly sending the game state so all peer could sync their state

When the host player disconnects, a new host is elected: the first connected player in the game player list becomes host

## HTTPs certificate

Follow official Let's Encrypt [instructions](https://certbot.eff.org/lets-encrypt/ubuntufocal-other) for Ubuntu.

1. run the app locally on port 80

   ```shell
   sudo NODE_ENV=production PORT=80 node apps/server
   ```

1. install certbot and certbot-dns-ovh plugin using snapd

   ```shell
   sudo snap install --classic certbot
   sudo ln -s /snap/bin/certbot /usr/bin/certbot
   sudo snap set certbot trust-plugin-with-root=ok
   sudo snap install certbot-dns-ovh
   ```

1. get 1h credentials from [OVH DNS](https://eu.api.ovh.com/createToken/), using your OVH ID and password, naming the script 'certbot' and allowing GET+PUT+POST+DELETE on `/domain/zone/*`

1. save the credentials in an `certbot/ovh.ini` file:

   ```shell
   dns_ovh_endpoint = ovh-eu
   dns_ovh_application_key = AkG1LEDihK0AEP9g
   dns_ovh_application_secret = k1oYVImXc3YQYxwA3DTUc2Ch6oI7stXN
   dns_ovh_consumer_key = KVw37RY59KXOrinnLEO1QIMSC7Dec0ST
   ```

1. run the certbot command

   ```shell
   certbot certonly --dns-ovh --dns-ovh-credentials hosting/certbot/ovh.ini -d tabulous.fr -d www.tabulous.fr --work-dir hosting/certbot --logs-dir hosting/certbot --config-dir hosting/certbot
   ```

1. copy relevant files to run it locally
   ```shell
   cp hosting/certbot/live/tabulous.fr/cert.pem keys/
   cp hosting/certbot/live/tabulous.fr/privkey.pem keys/
   ```

Here there are, copied from `hosting/certbot/live/tabulous.fr/` to `keys/\` folder.

# Server data operations

- create player
- find one/several players by id
- search players by their username
- update player's playing boolean (or full player)
- create full game
- find one game by id
- find games which player ids contains an id
- update full game
- delete game
- list game descriptors
- find one/several game descriptors by id

# Various learnings

Physics engine aren't great: they are all pretty deprecated. [Cannon-es can not be used yet](https://github.com/BabylonJS/Babylon.js/issues/9810).
When stacked, card are always bouncing.

Polygon extrusion does not support path (for curves like rounded corners), and the resulting mesh is not vertically (Y axis) centered.

`@storybook/addon-svelte-csf` doesn't work yet with storybook's webpack5 builder. What a pity...

Setting package's type to "module" is not possible, because `snowpack.config.js` would become an ESM module. Since it's using `require()` to load `svelte.config.js` it can not be a module.
Besides, Jest built-in support for modules [is still in progress](https://github.com/facebook/jest/issues/9430).

@web/test-runner, which is snowpack's recommendation, is not at the level of Jest. Running actual browsers to run test is an interesting idea (although it complexifies CI setup).
Chai is a good replacement for Jest's expect, and using mocha instead of Jasmine is a no-brainer.
However, two blockers appeared: Sinon can not mock entire dependencies (maybe an equivvalent rewire would), making mocking extremely hard, and @web/test-runner runs mocha in the browser, preventing to have an global setup script (mocha's --require option)

Finally, using vite solves all the above, and enables Jest again.
Testing server code on Node requires `NODE_OPTIONS=--experimental-vm-modules` while running jest. What a bummer.

Another pitfall with ESM and jest: `jest.mock()` does not work at all.
[Here is a ticket to follow](https://github.com/facebook/jest/issues/10025). Using Testdouble [may be an alternative](https://github.com/facebook/jest/issues/11786).

To make WebRTC work in real world scenario, it is paramount to share **every signal received**.
One must not stop listening to signal event after connection is established, and one muse not handle only `offer` and `answer` types.
This enables: trickle, further media addition, peers with no media while others have...

Removing server to only allow peer communication is really hard:

- a server is needed for peers to exchange webRTC offers and answers (signaling server)
- when host player is offline, a server is needed to give the new host all the required data
- we might need a TURN server to relay video/data streams in some situations

I started with SSE to push game invites to players, and Websocket to keep the signaling server independant from the app logic, but it's too many sockets for the same user.
GraphQL subscriptions over WS are perfect to implement both usecases.

Enabling tree shaking in Babylon.js is [cumbersom](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking), but really effective:
Final code went from 1417 modules to 674 (53% less) and the vendor.js file from 3782.23kb to 1389.03 (63% less).

Running game with Babylon's debug panel kills `setTimeout()`. Something under the hood must monkey patch it.

For decent in-game performance, textures must be GPU-compressed to KTX2 container format. This will skip CPU uncompressing jpeg/png content before passing it to the GPU.
However, it's not broadly supported on WebGL 1 platform, so I kept the png files as fallback.

Some GPU also require [dimensions to be multiple of 4](https://forum.babylonjs.com/t/non-displayable-image-after-converting-png-with-alpha-to-ktx2-webgl-warning-compressedteximage-unexpected-error-from-driver/16471)

Sizes:

- Splendor
  - cards: 372x260
  - tiles: 352x176
  - tokens: 380x184
- French suited cards: 360x260
- Klondike:
  - board: 1964x980

```shell
folder=apps/web/public/images/french-suited-cards; \
size=360x260; \
for file in $folder/!(*.gl1.png|!(*.png)); do \
  outFile=${file/.png/.out.png}; \
  convert -flop -strip -resize $size\! $file $outFile; \
  gl1File=${file/.png/.gl1.png}; \
  toktx --uastc 2 ${file/.png/.ktx2} $outFile; \
  convert -flop -rotate 180 $outFile $gl1File; \
  rm $outFile; \
done
```

1. flip image horizontally (front face on the left, back face on the right, mirrored), strip png ICC profile (ktx2 does not support them) and resize
2. convert to ktx2
3. make a png equivalent for WebGL1 engines, rotated so it match meshes's UV

There is no built-in way for the remote side of an WebRTC connection to know that video or audio was disabled.
The mute/unmute events are meant for network issues. Stopping a track is definitive. Adding/removing track from stream only works locally (or would trigger re-negociation)

STUN & TURN server:

```shell
docker run -d --network=host coturn/coturn --external-ip=78.192.173.27 --relay-ip=192.168.1.45 -X -v -u tabulous:soulubat -a -f -r tabulous

```
