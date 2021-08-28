# TODO

## Refactor

- behaviors may not care about active selection (game-interaction/game-engine should)
- server logging (warning on invalid descriptors)
- enable [Babylon.js treeshaking](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
- all manager managing a collection of behaviors should check their capabilities
- moves images to server
- completly disable Babylon input management
- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- parametrize and serialize UVs

## Single player

- player's hand
- stack actions:
  - draw multiple cards (either in hand, or in front of them)
  - distribute multiple cards to players (either in their hand, or in front of them)
  - put under
  - feedback on stacking
- boards
- keyboard
- feedback on stacking
- updating a saved camera position is not intuitive

## Multi player

- invite players by name and id
- search players by name
- indicates when remote stream is muted/stopped

# Known issues

- crash when reordering stack
  ```js
  async reorder(ids) {
    // ...
    for (const mesh of stack) {
      mesh.isPickable = false // TypeError: mesh is undefined
  ```
- flip stacked items only flip individual card: it should also invert the ordering (flip the whole stack)
- moving items bellow other does not apply gravity to them
- on vite reload, all players could become hosts or peers simultaneously

# Ideas

## Game setup

- min/max number of players allowed
- players' positions
- token/card enabled behaviors (overall+per item setting?)
- personnal hand support (impact on the draw and deal commands)

## Game UI:

- top right, an help button with drawing for base commands (pan, camera, DnD, main actions)
- top right, an link to the rule book, opened in a floating pane, either taking whole screen, or a third of it
- top left, in a column, player avatars/videos, with number of tokens/cards in hand, and mute indicator & command
- bottom left, chat window
- bottom, expansible area showing player's hand

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

When the host player disconnects, a new host is elected: the first connected player in the game player list becomes host

# HTTPs certificate

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
   certbot certonly --dns-ovh --dns-ovh-credentials certbot/ovh.ini -d tabulous.fr -d www.tabulous.fr --work-dir certbot --logs-dir certbot --config-dir certbot
   ```

1. copy relevant files to run it locally
   ```shell
   cp certbot/live/tabulous.fr/cert.pem keys/
   cp certbot/live/tabulous.fr/privkey.pem keys/
   ```

Here there are, copied from `certbot/live/tabulous.fr/` to `keys/\` folder.

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

To make WebRTC work in real world scenario, it is paramount to share **every signal received**.
One must not stop listening to signal event after connection is established, and one muse not handle only `offer` and `answer` types.
This enables: trickle, further media addition, peers with no media while others have...

Removing server to only allow peer communication is really hard:

- a server is needed for peers to exchange webRTC offers and answers (signaling server)
- when host player is offline, a server is needed to give the new host all the required data
- we might need a TURN server to relay video/data streams in some situations

I started with SSE to push game invites to players, and Websocket to keep the signaling server independant from the app logic, but it's too many sockets for the same user.
GraphQL subscriptions over WS are perfect to implement both usecases..

For decent in-game performance, textures must be GPU-compressed to KTX2 container format. This will skip CPU uncompressing jpeg/png content before passing it to the GPU.
However, it's not broadly supported on WebGL 1 platform, so I kept the png files as fallback.

Some GPU also require [dimensions to be multiple of 4](https://forum.babylonjs.com/t/non-displayable-image-after-converting-png-with-alpha-to-ktx2-webgl-warning-compressedteximage-unexpected-error-from-driver/16471)

Sizes:

- cards: 372x260
- tiles: 352x176
- tokens: 380x184

```shell
folder=apps/web/public/images/splendor/1; \
size=372x260; \
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
