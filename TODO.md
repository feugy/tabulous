# TODO

- select player color in games

## Road to beta

- skin(s)
- interface in English
- always go fullscreen when entering game
- allow spliting aside in a different window
- rework lights & shadows
- server logging (warning on invalid descriptors) + log file rotation
- fix obvious bugs bellow

## Refactor

- @urql/core@3.1.1: receiveGameListUpdates subscribtion fails because urql's stringification sends the whole games.graphql file instead of the subscription as a payload. This is because [these lines](https://github.com/urql-graphql/urql/pull/2871/files#diff-425e8fcb48a8df1865f99ca1fb981873c6d0ef33ee3856e18f85a8b449bb81b7R41-R42)
- add tests for web/src/utils/peer-connection
- use node 18 when msw/interceptor will [handle it](https://github.com/mswjs/interceptors/pull/283)
- ts-check all the things!
- group candidate target per kind for performance
- keep anchor ids
- create Animation objects as part of runAnimation() (constant frameRate of 60)
- all manager managing a collection of behaviors should check their capabilities + stackable/anchorable
- game-manager is just a gigantic mess!!! no single responsibility, global state all over the place
- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- stackable duration override's movable duration on
- move camera when drop zone is not in sight and dropping on it

## UI

- bug: 6-takes: snapping to the wrong anchor (when 2 players are snapping to different anchors)
- bug: on a game with no textures, loading UI never disappears (and game manager never enables) as onDataLoadedObservable is not triggered
- style: friend list highlited element are not readable
- style: player videos on a two player game should be vertically lay out
- check headings ordering
- document keyboard shortcuts in the help panel
- explicit layout in JS for aside videos
- per game configurable single/double/lon tap/left click action
- detailable/stackable behavior: preview a stack of meshes
- hide/distinguish non-connected participants?
- hide media dropdown unless hovering?
- distribute multiple meshes to players' hand
- shortcuts cheatsheet
- hand support for quantifiable behavior
- put/draw under
- "box" space for unusued/undesired meshes
- command to "switch place" around the table, for games like Belote

23:09:47,374 Uncaught InternalError: too much recursion
Immutable 10
players-9eebbfcf.js:315:100318 (https://github.com/ReactiveX/rxjs/blob/630d2b009b5ae4e8f2a62d9740738c1ec317c2d5/src/internal/scheduler/intervalProvider.ts#L22)
Immutable 128

This is bound to rxjs asyncScheduler, which depends on the operator used (probably time operators)

## Server

- bug: timezone used for Serverside rendering is wrong
- allows a single connection per player (discards other JWTs)
- better coTURN integration (password management and rotation)

## Hosting

- scheduled DB backups: cp /var/lib/redis/dump.{rdb,"$(date +%Y%m%d-%H%M).rdb"}
- firewall
- where to store secrets?
- deploy in a folder named after the commit SHA
- use symlink to switch between deployments (including conf files)
- notifies on deployment failures/success

## Known issues

- moving items bellow other does not apply gravity to them

## Ideas

### Game setup

- min/max number of players allowed
- players' positions

### Game UI:

- visual hint when receiving messages on collapsed section
- show contextual help (for example, on hover) to indicates which commands are available

## Interaction model

| Action on table  | Tabletopia                        | Tabulous                                |
| ---------------- | --------------------------------- | --------------------------------------- |
| zoom camera      | +/-, molette                      | +/-, molette, pinch                     |
| move camera      | W/A/S/D, left drag,               | arrows, right drag, 2 fingers drag      |
| rotate camera    | right drag                        | ctrl+arrow, middle drag, 3 fingers drag |
| multiple select  | shift+left click, shift+left drag | left drag, finger drag                  |
| fullscreen       | ~/esc                             | _button_                                |
| save camera      | shift+number, _menu action_       | ctrl+number, _button_                   |
| restore camera   | number, _menu action_             | number, _button_                        |
| menu             | right click                       | _N/A_                                   |
| toggle hand      | _menu action_                     | H, _button_                             |
| toggle interface | _menu action_                     | _N/A_                                   |
| help             | F1, _button_, _menu action_       | F1, _N/A_                               |
| magnify          | Z, _menu action_                  | _N/A_                                   |

| Action on Mesh | Tabletopia                                     | Tabulous                                        |
| -------------- | ---------------------------------------------- | ----------------------------------------------- |
| move           | left drag                                      | left drag, 1 finger drag                        |
| select         | left click                                     | _N/A_                                           |
| menu           | right click                                    | right click, 2 fingers tap                      |
| view details   | double left click                              | V, long left click, long tap, _menu action_     |
| flip           | F, _menu action_                               | F, left click, tap, _menu action_               |
| rotate         | Ctrl+left drag, Q/E/PgUp/PgDown, _menu action_ | R, double left click, double tap, _menu action_ |
| (un)lock       | L, _menu action_                               | L, _menu action_                                |
| put under      | U, _menu action_                               | _N/A_                                           |
| take to hand   | T, move to screen bottom, _menu action (draw)_ | D, move to screen bottom, _menu action_         |
| stack together | ??                                             | G, _menu action_                                |

| Action on Stacks    | Tabletopia                              | Tabulous         |
| ------------------- | --------------------------------------- | ---------------- |
| shuffle             | _menu action_                           | S, _menu action_ |
| draw N to hand      | molette+left drag, _menu action (take)_ | D, _menu action_ |
| pop N to tableottom | ??                                      | U, _menu action_ |
| deal N              | molette+left drag, _menu action (deal)_ | _N/A_            |
| stack on top        | _move over_                             | _move over_      |
| stack at the bottom | Shift+_move over_                       | _N/A_            |

In Tabletopia, being forced to do click (either select or menu) before triggering actions (shortcut or menu) is a bummer.
They support keyboard, but not fingers.

## Game lifecycle

1. player A calls `createGame(kind)`
1. server creates a game id, loads scene descriptor, adds player A to the player list, returns the game id
1. player A calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player A calls `invite(gameId, playerId)` to invite player B
1. player B calls `loadGame(id)`
1. server returns the game scene descriptor and player list
1. player B tries to connect with all players already connected (see connection handshake)

### The host role

The host player is in charge of:

1. be the source of thruth
1. sending an updated game descriptor to new peers
1. storing the game descriptor locally and/or on server
1. regularly sending the game state so all peer could sync their state

When the host player disconnects, a new host is elected: the first connected player in the game player list becomes host

## Player migration

When introducing user own password, several data changes where needed:

- add password hash to existing accounts: `"password": "ba5ad8fd3d20cefebf58272fe833c925061097d79237e7363fef45802fddd6c9c57434e8a125378257a569a90dd45456620262a2ea21be49ed7e716d5503beee"`
- change their ids sed -i 's/"1789"/"dams-1789"/g' ./apps/server/data/\*.json

## Various learnings

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

Enabling tree shaking in Babylon.js is [cumbersome](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking), but really effective:
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
- Prima Ballerina cards: 1020x328

```shell
folder=apps/web/public/images/prima-ballerina; \
size=1020x328; \
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

Some useful commands:

- [remove background color](https://stackoverflow.com/a/69875689/1182976):
  ```
  convert in.png -alpha off -fuzz 10% -fill none -draw "matte 1,1 floodfill"  \( +clone -alpha extract -blur 0x2 -level 50x100% \) -alpha off -compose copy_opacity -composite out.png
  ```
- [convert all pngs/jpgs to webp](https://stackoverflow.com/a/27784462/1182976):
  ```
  convert *.png -set filename:base "%[basename]" -define webp:lossless=true "%[filename:base].webp"
  ```
  ```
  convert *.jpg -set filename:base "%[basename]" -define webp -quality 90 "%[filename:base].webp"
  ```
- [extract a given polygon from an image](https://stackoverflow.com/a/18992215/1182976):
  ```
  convert -size 100x100 xc:none -draw "roundrectangle 0,0,100,100,15,15" mask.png
  convert in.png -matte mask.png -compose DstIn -composite out.png
  ```

There is no built-in way for the remote side of an WebRTC connection to know that video or audio was disabled.
The mute/unmute events are meant for network issues. Stopping a track is definitive. Adding/removing track from stream only works locally (or would trigger re-negociation)

Nice sources for 3D textures:

- [3DTextures](https://3dtextures.me/) (free)
- [Architextures](https://architextures.org/textures) (copyrighted)

Run playwright in debug mode, on a given file: `PWDEBUG=1 pnpm --filter web test:integration:run -- home.spec`

WebRTC recent (2021) changes now allows [perfect negociation](https://w3c.github.io/webrtc-pc/#perfect-negotiation-example), which highly simplifies.
Thus, connecting RTCDataChanel and RTCPeerConnection may happen in random order. One must wait for both event and then consider connection to be established.
One must not acquire Media stream in parallel, because it actually holds different copies of the stream, which must be released independently.
It is simpler to acquire once, and return the same result to all "parallel" requesters.

`enumerateDevice` has a limitation: when user never allowed it yet, it's returning empty labels.
There's no good way to solve it, and it's an [ongoing discussion](https://github.com/w3c/mediacapture-main/issues/874)

Game parameters need the ability to express contraints in between parameters (second parameter options depends on selected value for first parameter).
JSON Type Definition [does not allow conditionals](https://ajv.js.org/guide/schema-language.html#json-type-definition-2), and scafolding UI component out of [Joi schema](https://joi.dev/api/?v=17.7.0#anydescribe) is too complicated, so let's use [JSON Schema](https://ajv.js.org/json-schema.html#if-then-else)

[online JSON schema playground](https://extendsclass.com/json-schema-validator.html)

How to export from blender to Babylon?

1. craft meshes into blender. Pay attention to the following points:

- try exported meshes in https://sandbox.babylonjs.com/
- set normals to faces
- no global/local transformation
- set origin to geometry
- triangulate some complex face (Edit mode + select + Ctrl+T) to avoid unnecessary edges when selected, and undesited additional faces on render

1. export as obj (vertices + uv mapping)

- selection only
- Z forward
- Y up
- Apply modifier
- UV coordinates
- Normals
- do not export materials
