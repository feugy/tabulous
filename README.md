# Tabulous

[![GitHub](https://img.shields.io/github/license/feugy/tabulous)][license]
[![CI](https://github.com/feugy/tabulous/actions/workflows/CI.yml/badge.svg)](https://github.com/feugy/atelier/tabulous/workflows/CI.yml)
[![Codacy](https://app.codacy.com/project/badge/Grade/36bc5e1d473746f09656d1ffc8dec813)](https://www.codacy.com/gh/feugy/tabulous/dashboard?utm_source=github.com&utm_medium=referral&utm_content=feugy/tabulous&utm_campaign=Badge_Grade)

Tabulous is virtual table-top game engine: [see it on tabulous.fr](https://tabulous.fr).

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

[license]: https://github.com/feugy/tabulous/blob/main/LICENSE
