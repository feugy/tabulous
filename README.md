# Tabulous

[![Vercel](https://vercelbadge.vercel.app/api/feugy/tabulous)][production]
[![GitHub](https://img.shields.io/github/license/feugy/tabulous)][license]
[![CI](https://github.com/feugy/tabulous/actions/workflows/CI.yml/badge.svg)](https://github.com/feugy/atelier/tabulous/workflows/CI.yml)
[![Codacy](https://app.codacy.com/project/badge/Grade/36bc5e1d473746f09656d1ffc8dec813)](https://www.codacy.com/gh/feugy/tabulous/dashboard?utm_source=github.com&utm_medium=referral&utm_content=feugy/tabulous&utm_campaign=Badge_Grade)

Tabulous is virtual table-top game engine: [see it on tabulous.fr][production].

Meet your friends online to play your favorite games!

**[Work in Progress]**

## How to use

You need Node.js 16+ and NPM.

1. Checkout the code:
   ```shell
   git clone git@github.com:feugy/tabulous.git
   cd tabulous
   ```
1. Fetch dependencies:
   ```shell
   npm i
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
1. Start in watch mode (both server and client):
   ```shell
   npm start
   ```
1. Your favorite browser should open and display a warning about self-signed SSL certificate. Bypass it, and start developping.

### Production

All the magic happens during continuous integration/deployment:

1. Merge or push some code on `main` branch:
1. Continuous Integration workflow kicks in, running linter, formatter and tests
1. If it succeeds, Continuous Deployment workflow starts, build the client and server applications, packaging and uploading them to the VPS, then restarting services.

[production]: https://tabulous.fr
[license]: https://github.com/feugy/tabulous/blob/main/LICENSE
