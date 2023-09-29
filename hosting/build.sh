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
pnpm -F server --ignore-scripts --prod deploy dist/server
cd dist/server
tar --create --file ../server.tar.gz -z * 
cd ../..
rm -rd dist/server

# build game-utils
rm -rf node_modules apps/*/node_modules
pnpm -F game-utils --ignore-scripts --prod deploy dist/game-utils
cd dist/game-utils
tar --create --file ../../dist/game-utils.tar.gz -z *
cd ../..
rm -rd dist/game-utils

# build games
cd apps/games
tar --create --file ../../dist/games.tar.gz -z *
cd ../..