# Tabulous

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

### Run locally

1. Build the client application:
   ```shell
   npm run build --workspace apps/web
   ```
1. Run the server (requires access to port 443, and valid SSL certificate PEM files):
   ```shell
   NODE_ENV=production node apps/server
   ```
1. Open https://localhost in your browser.

### Develop

1. Start in watch mode (both server and client):
   ```shell
   npm run dev
   ```
1. Your favorite browser should open and display a warning about self-signed SSL certificate. Bypass it, and start developping.

### Production

All the magic happens during continuous integration/deployment:

1. Merge or push some code on `main` branch:
1. Continuous Integration workflow kicks in, running linter, formatter and tests
1. If it succeeds, Continuous Deployment workflow starts, build the client and server applications, packaging and uploading them to the VPS, then restarting services.
