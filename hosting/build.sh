#!/bin/bash
# it assumes being ran in the repo root folder
set -x

# clean up previous build
rm -rf dist
mkdir dist

# scripts and services configuration
cp hosting/deploy.sh dist/
cp hosting/start.sh dist/
cp hosting/tabulous.nginx dist/
cp hosting/tabulous.systemd dist/
cp .nvmrc dist/

# build UI
npm run build --workspace apps/web
cd apps/web/dist
tar --create --file ../../../dist/web.tar.gz -z *
cd ../../..

# build server
rm -rf node_modules
npm ci --production -w @tabulous/server
cd apps/server
tar --create --file ../../dist/server.tar.gz -z ../../node_modules/ src/ package.json 
cd ../..

# build games
cd apps/games
tar --create --file ../../dist/games.tar.gz -z assets/ package.json 
cd ../..