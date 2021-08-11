# Tabulous

Tabulous is virtual table-top game engine.

Meet your friends online to play your favorite games!

**[Work in Progress]**

## How to use

You need Node.js 15+ and NPM.

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

### Production

1. Build the client application:
   ```shell
   npm run build
   ```
1. Run the server (requires access to port 443, and valid SSL certificate PEM files):
   ```shell
   NODE_ENV=production node apps/server
   ```
1. Open https://localhost in your browser.

### Development

1. Start in watch mode:
   ```shell
   npm run dev
   ```
1. Your favorite browser should open and display a warning about self-signed SSL certificate. Bypass it, and start developping.
