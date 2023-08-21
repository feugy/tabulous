# Tabulous

[![Vercel](https://vercelbadge.vercel.app/api/feugy/tabulous)][production]
[![GitHub](https://img.shields.io/github/license/feugy/tabulous)][license]
[![CI](https://github.com/feugy/tabulous/actions/workflows/CI.yml/badge.svg)](https://github.com/feugy/atelier/tabulous/workflows/CI.yml)
[![Codacy](https://app.codacy.com/project/badge/Grade/36bc5e1d473746f09656d1ffc8dec813)](https://www.codacy.com/gh/feugy/tabulous/dashboard?utm_source=github.com&utm_medium=referral&utm_content=feugy/tabulous&utm_campaign=Badge_Grade)

Tabulous is online table-top game platform: [see it on tabulous.fr][production].

Meet your friends online to play your favorite games!

Once authenticated, you'll have access to the catalog (Chess, Klondike, Draughts...), and you can start new games.

The game 3D engine lets you handle cards, dice, pawns, tokens, boards... as you would do in real life.

Each game comes with a rule book, but the rules are not enforced, and you are free to apply yours.

To player with other people, you will first have to request friendship with them (or accept their requests), and invite them from your friend list.

Tabulous is built in Javascript with Sveltekit, Babylon.js, Rx.js, Fastify and Redis. It uses GraphQL and WebRTC.

**[Work in Progress]**

## How to use

You need [git], [Node.js 20][node], [PNPM] and [Redis]

1. Checkout the code:

   ```shell
   git clone git@github.com:feugy/tabulous.git
   cd tabulous
   ```

1. Fetch dependencies:

   ```shell
   fnm
   pnpm i
   ```

1. Then, run in dev or production mode.

### Develop

1. Creates `apps/web/.env` file with the following content:

   ```shell
   # WEB_USE_GITHUB_PROVIDER=true
   # WEB_USE_GOOGLE_PROVIDER=true
   WEB_GRAPHQL_URL=http://localhost:3001/graphql
   WEB_GAME_ASSETS_URL=http://localhost:3001/games
   WEB_AUTH_URL=http://localhost:3001/auth
   ```

1. Creates `apps/server/.env` file with the following content:

   ```shell
   TURN_SECRET=abcd1234
   ```

1. Start in watch mode (both server and client):

   ```shell
   pnpm start
   ```

1. Your favorite browser should open and display a warning about self-signed SSL certificate. Bypass it, and start developping.

### Test

The entire unit test suite (all projects) runs with `pnpm t`/`pnpm test`.

Run a given project unit test suite with `pnpm test:FOLDER_NAME` (`pnpm test:web`, `pnpm test:server`...).

Run a given project watch mode with `pnpm dev:FOLDER_NAME` (`pnpm dev:web`, `pnpm dev:server`...).

Run a single test file with `pnpm --filter FOLDER_NAME test/dev FILE_NAME` (`pnpm --filter web dev 3d/engine`, `pnpm --filter server test players-resolver`...).

### Production

All the magic happens during continuous integration/deployment:

1. Merge or push some code on `main` branch:
1. Continuous Integration workflow kicks in, running linter, formatter and tests
1. If it succeeds, Continuous Deployment workflow starts, build the client and server applications, packaging and uploading them to the VPS, then restarting services.

[production]: https://tabulous.fr
[license]: https://github.com/feugy/tabulous/blob/main/LICENSE
[git]: https://git-scm.com/downloads
[redis]: https://redis.io/docs/getting-started/installation/
[node]: https://nodejs.org/en/download/
[pnpm]: https://pnpm.io/installation
