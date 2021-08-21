# TODO

- share camera position to game host for saving

## Refactor

- behaviors may not care about active selection (game-interaction/game-engine should)
- server logging (warning on invalid descriptors)
- enable [Babylon.js treeshaking](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
- all manager managing a collection of behaviors should check their capabilities
- moves images to server
- completly disable Babylon input management
- UI lib: https://svelte-materialify.vercel.app/getting-started/installation/
- disable any possible action while animating

## Single player

- boards
- player's hand
- stack actions:
  - draw multiple cards (either in hand, or in front of them)
  - distribute multiple cards to players (either in their hand, or in front of them)
- parametrize and serialize UVs
- keyboard

## Multi player

- invite players by name and id
- search players by name
- persistant chat
- indicates when remote stream is muted/stopped

# Known issues

- all textures but card ones are invisible on Huawei. May be [this](https://forum.babylonjs.com/t/engine-crashes-on-android-devices/23176).
  > BJS - [23:43:20]: Unable to compile effect:
  > BJS - [23:43:20]: Uniforms: world, view, viewProjection, vEyePosition, vLightsType, vAmbientColor, vDiffuseColor, vSpecularColor, vEmissiveColor, visibility, vFogInfos, vFogColor, pointSize, vDiffuseInfos, vAmbientInfos, vOpacityInfos, vReflectionInfos, vEmissiveInfos, vSpecularInfos, vBumpInfos, vLightmapInfos, vRefractionInfos, mBones, vClipPlane, vClipPlane2, vClipPlane3, vClipPlane4, vClipPlane5, vClipPlane6, diffuseMatrix, ambientMatrix, opacityMatrix, reflectionMatrix, emissiveMatrix, specularMatrix, bumpMatrix, normalMatrix, lightmapMatrix, refractionMatrix, diffuseLeftColor, diffuseRightColor, opacityParts, reflectionLeftColor, reflectionRightColor, emissiveLeftColor, emissiveRightColor, refractionLeftColor, refractionRightColor, vReflectionPosition, vReflectionSize, vRefractionPosition, vRefractionSize, logarithmicDepthConstant, vTangentSpaceParams, alphaCutOff, boneTextureWidth, morphTargetTextureInfo, morphTargetTextureIndices, vDetailInfos, detailMatrix, previousWorld, previousViewProjection, vLightData0, vLightDiffuse0, vLightSpecular0, vLightDirection0, vLightFalloff0, vLightGround0, lightMatrix0, shadowsInfo0, depthValues0, viewFrustumZ0, cascadeBlendFactor0, lightSizeUVCorrection0, depthCorrection0, penumbraDarkness0, frustumLengths0, diffuseSampler, ambientSampler, opacitySampler, reflectionCubeSampler, reflection2DSampler, emissiveSampler, specularSampler, bumpSampler, lightmapSampler, refractionCubeSampler, refraction2DSampler, boneSampler, morphTargets, detailSampler, shadowSampler0, depthSampler0
  > BJS - [23:43:20]: Attributes: position, normal
  > BJS - [23:43:20]: Defines:

#define DIFFUSEDIRECTUV 0
#define DETAILDIRECTUV 0
#define DETAIL_NORMALBLENDMETHOD 0
#define AMBIENTDIRECTUV 0
#define OPACITYDIRECTUV 0
#define EMISSIVEDIRECTUV 0
#define SPECULARDIRECTUV 0
#define BUMPDIRECTUV 0
#define NORMAL
#define NUM_BONE_INFLUENCERS 0
#define BonesPerMesh 0
#define LIGHTMAPDIRECTUV 0
#define SHADOWFLOAT
#define NUM_MORPH_INFLUENCERS 0
#define ALPHABLEND
#define PREPASS_IRRADIANCE_INDEX -1
#define PREPASS_ALBEDO_INDEX -1
#define PREPASS_DEPTH_INDEX -1
#define PREPASS_NORMAL_INDEX -1
#define PREPASS_POSITION_INDEX -1
#define PREPASS_VELOCITY_INDEX -1
#define PREPASS_REFLECTIVITY_INDEX -1
#define SCENE_MRT_COUNT 0
#define VIGNETTEBLENDMODEMULTIPLY
#define SAMPLER3DGREENDEPTH
#define SAMPLER3DBGRMAP
#define LIGHT0
#define DIRLIGHT0
#define SHADOW0
#define SHADOWPCF0
#define SHADOWS

- all textures are black on Xperia tablet [issue](https://forum.babylonjs.com/t/babylonjs-is-running-webgl-1-0-instead-of-2-0/2992/6)
- selection hint does not consider camera angle
- flip stacked items only flip individual card: it does not change the ordering
- flipping or rotating item does not change vertical position: items above it will still be above it at the end
- moving items bellow other does not apply gravity to them

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

## Joining a game:

- any player can mute, or kick, another player (really?)

# Interaction model

| Action on table  | Tabulous                     | Tabletopia                  |
| ---------------- | ---------------------------- | --------------------------- |
| zoom camera      | molette, pinch               | molette, +/-                |
| move camera      | left click, tap              | left drag, W/A/S/D          |
| rotate camera    | right drag, long finger drag | right drag                  |
| fullscreen       | _button_                     | ~/esc                       |
| save camera      | _button_                     | shift+number, _menu action_ |
| restore camera   | _button_                     | number, _menu action_       |
| menu             | _N/A_                        | right click                 |
| toggle hand      | _N/A_                        | _menu action_               |
| toggle interface | _N/A_                        | _menu action_               |
| help             | _N/A_                        | F1, _button_, _menu action_ |
| magnify          | _N/A_                        | Z, _menu action_            |

| Action on Mesh  | Tabulous                                     | Tabletopia                                       |
| --------------- | -------------------------------------------- | ------------------------------------------------ |
| move            | left drag, finger drag                       | left drag                                        |
| select          | _N/A_                                        | left click                                       |
| multiple select | left drag table, finger drag table           | Shift+left click, Shift+left drag                |
| menu            | mouse hover, single tap                      | right click                                      |
| view details    | double left click, double tap, _menu action_ | double left click                                |
| flip            | left click, _menu action_                    | F, _menu action_                                 |
| rotate          | right click, _menu action_                   | Ctrl+left drag, Q/E/PgUp/PgDown, _menu action_   |
| (un)lock        | _N/A_                                        | L, _menu action_                                 |
| put under       | _N/A_                                        | U, _menu action_                                 |
| take to hand    | _N/A_                                        | T, _move to screen bottom_, _menu action (draw)_ |

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
Some GPU also require [dimensions to be multiple of 4](https://forum.babylonjs.com/t/non-displayable-image-after-converting-png-with-alpha-to-ktx2-webgl-warning-compressedteximage-unexpected-error-from-driver/16471)

Sizes:

- cards: 372x260
- tiles: 352x176
- tokens: 380x184

```shell
folder=apps/web/public/images/splendor/1; \
size=372x260; \
for file in $folder/*.png; do \
  outFile=${file/.png/.out.png}; \
  convert -flop -strip -resize $size\! $file $outFile; \
  toktx --uastc 4 ${file/.png/.ktx2} $outFile; \
  rm $outFile; \
done
```

1. flip image horizontally (front face on the left, back face on the right, mirrored), strip png ICC profile (ktx2 does not support them) and resize
2. convert to ktx2

There is no built-in way for the remote side of an WebRTC connection to know that video or audio was disabled.
The mute/unmute events are meant for network issues. Stopping a track is definitive. Adding/removing track from stream only works locally (or would trigger re-negociation)

STUN & TURN server:

```shell
docker run -d --network=host coturn/coturn --external-ip=78.192.173.27 --relay-ip=192.168.1.45 -X -v -u tabulous:soulubat -a -f -r tabulous

```
