# TODO

## Refactor

- Control manager: trigger rule when action is finished?
- hand: reuse playMeshes() and pickMesh() in handDrag()
- replace windicss with a successor (UnoCSS)
- add tests for web/src/utils/peer-connection + web/src/stores/graphql
- group candidate target per kind for performance
- all manager managing a collection of behaviors should check their capabilities
- stackable/anchorable should check the capabilities of stacked/anchored meshes
- create Animation objects as part of runAnimation() (constant frameRate of 60)
- game-manager might be teardown in several simpler parts
- stackable duration override's movable duration

## UI

- fix(web): indicators attach point does not consider the camera position.
- when hovering target, highlight could have the dragged mesh's shape, not the target shape (what about parts?)
- improve selection accuracy, especially with cylindric meshes
- hand count on peer pointers/player tab?
- command to reset some mesh state and restart a game (Mah-jong, Belote)
- "box" space for unusued/undesired meshes
- hide/distinguish non-connected participants?
- distribute multiple meshes to players' hand
- shift + drop/drag: put/pop below the stack
- molette + (shift) + drag: decrement/pop multiple
- hand support for quantifiable
- always go fullscreen when entering game?
- command to "switch place" around the table, for games like Belote
- check headings ordering

## Server

- bug: lobby to parametrized game: handle concurrent parameters (playground)
- allows a single connection per player (discards other JWTs)
- better coTURN integration (password management and rotation)

## Hosting

- firewall
- where to store secrets?
- deploy in a folder named after the commit SHA
- use symlink to switch between deployments (including conf files)
- notifies on deployment failures/success

## Known "wont-fix" issues

- moving a mesh that is below other meshes only moves the moved mesh and does not apply gravity to remaining ones.

## Interaction model

| Action on table | Commands                                |
| --------------- | --------------------------------------- |
| zoom camera     | +/-, molette, pinch                     |
| move camera     | arrows, right drag, 2 fingers drag      |
| rotate camera   | ctrl+arrow, middle drag, 3 fingers drag |
| multiple select | left drag, finger drag                  |
| fullscreen      | _button_                                |
| save camera     | ctrl+number, _button_                   |
| restore camera  | number, _button_                        |
| toggle hand     | H, _button_                             |
| help            | F1, _button_                            |

| Action on Mesh | Commands                            |
| -------------- | ----------------------------------- |
| move           | left drag, 1 finger drag            |
| action menu    | right click, 2 fingers tap          |
| view details   | long hover, long tap                |
| 1st action     | left click, tap                     |
| 2st action     | long left click, long 2 fingers tap |

In Tabletopia, being forced to do click (either select or menu) before triggering actions (shortcut or menu) is a bummer.
They support keyboard, but no touchable interface.

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

### Action propagation and cascade

1. `mesh.medatadata.fn()` are only triggered by humans and `moveManager.onMoveObservable`
1. behavior should record action to the Control manager before applying them so they could cascade in order (extreme some rare cases like drawing and snapping)
1. when triggering an action from a notification, behavior must report it with `isLocal` flag to avoid re-cascading
1. `controlManager.apply()` is only applying peers and replay actions: it enrichs their notifications with `isLocal`
1. Replay manager and Game engine ignore notifications marked as local

## Various learnings

Physics engine aren't great: they are all pretty deprecated. [Cannon-es can not be used yet](https://github.com/BabylonJS/Babylon.js/issues/9810).
When stacked, card are always bouncing.
Might worth trying out Babylon@6's built-in physics

Polygon extrusion does not support path (for curves like rounded corners), and the resulting mesh is not vertically (Y axis) centered.

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

1. flip image horizontally (front face on the left, back face on the right, mirrored), strip png ICC profile (ktx2 does not support them) and resize
2. convert to ktx2
3. make a png equivalent for WebGL1 engines, rotated so it match meshes's UV

Some useful imagemagick commands:

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

Pnpm has a super nice feature: interactive dependency update: `pnpm update -i --latest -r`

For choosing game colors:

1. use https://coolors.co/ and stick color hex codes (no '#' prefix) separated with '-'.
2. make sure player colors have good contrast with white text.
3. make sure player colors have sufficient contrast with table texture/color.
4. try as much as possible to have player colors with enough distance, to avoid confusion.
5. black is a great player color! Transparent colors work as well.

[Automerge](https://automerge.org) looked really promising, but isn't a good fit for Tabulous, because the storage format is binary.
Besides being hard to debug and troubleshoot, it requires many encoding/decoding operations since GraphQL only allows text,
discards any database migrations or server-side operations (unless rebuilding the document on server-side), and the overall effort of
refactoring all communciation pipes and storage code does not really worth it.

Finite State Machines (FSM) could be a good fit for game rules. Chess for example: a global FSM for game, one for each player, one for each piece.
Transition are possible moves, all relative to the piece's position and direction. FSM could be used to restict action menu items, highlight possible location when starting moving, or revert invalid moves after they are made.
[XState](https://xstate.js.org/docs/) could match (what about the performance?), especially because of designing and debugging tools.

Good [read](https://gameprogrammingpatterns.com)

TypeScript compiler's `checkJS` is the root of evil. It checks files in transitive dependencies we have no control on, and that are extremely hard to trace and exclude. Selective opt-in with `@ts-check` is annoying but yields much better results.
