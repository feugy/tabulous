# TODO

Roadmap

- games: generic card game
- lawyer council
- web: terms & condition
- web: cookie policy
- server + web: first log-in with T&C

## Brittle tests

- `InputManager › given an initialized manager() › handles multiple pointers taps`

  > `expect(received).toHaveLength(expected)` line 1319 (1 long received)

- `Dropdown component › given textual options › closes menu on click`

  > `expect(received).toBeNull()` line 115 (menu does exist)

- `Typeahead component › given object options › closes menu with keyboard and opens on focus`

  > `expect(received).toBeNull()` line 126 (menu does exist)

## Refactor

- ts-check all the things!
- removes nginx to directly use the node server?
- group candidate target per kind for performance
- keep anchor ids
- create Animation objects as part of runAnimation() (constant frameRate of 60)
- jest matchers with mesh (toHaveBeenCalledWith, toHaveBeenNthCalledWith)
- all manager managing a collection of behaviors should check their capabilities
- game-manager is just a gigantic mess!!! no single responsibility, global state all over the place
- component, connected-component and routes rendering tests
- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- stackable duration override's movable duration on
- move camera when drop zone is not in sight and dropping on it

## UI

- bug: animating visibility from 0 to 1 creates trouble with texture alpha channel
- bug: ICE failed message when peer reload their browser??
- bug: attached, unselected, mesh are not ignored during dragging
- bug: on a game with no textures, loading UI never disappears (and game manager never enables) as onDataLoadedObservable is not triggered
- click on stack size to select all/select stack on push?
- collect player preferences when joining a game (requires to alter & reload game when joining rather than inviting)
- option to invite players with url
- distribute multiple meshes to players'hand
- shortcuts cheatsheet
- peer notifications: joining, joined, left, error (stop waiting when navigating away)
- hand support for quantifiable behavior
- put/draw under
- fullscreen and default key (F11)

## Server

- invite players who have no account yet
- allows a single connection per player (discards other JWTs)
- logging (warning on invalid descriptors)
- better coTURN integration (password management and rotation)

## Hosting

- where to store secrets?
- deploy in a folder named after the commit SHA
- use symlink to switch between deployments (including conf files)
- rotates log files
- notifies on deployment failures/success
- automate SSH renewal with certbot

# Known issues

- moving items bellow other does not apply gravity to them

# Ideas

## Game setup

- min/max number of players allowed
- players' positions

## Game UI:

- visual hint when receiving messages on collapsed section
- show contextual help (for example, on hover) to indicates which commands are available

# Interaction model

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

STUN & TURN server:

```shell
docker run -d --network=host coturn/coturn --external-ip=78.192.173.27 --relay-ip=192.168.1.45 -X -v -u tabulous:soulubat -a -f -r tabulous

```

Nice sources for 3D textures:

- [3DTextures](https://3dtextures.me/) (free)
- [Architextures](https://architextures.org/textures) (copyrighted)
