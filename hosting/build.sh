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

# build server
rm -rf node_modules apps/*/node_modules
pnpm --filter server --prod deploy dist/server
cd dist/server
tar --create --file ../server.tar.gz -z node_modules/ src/ migrations/ package.json 
cd ../..
rm -rd dist/server

# build games
cd apps/games
tar --create --file ../../dist/games.tar.gz -z *
cd ../..