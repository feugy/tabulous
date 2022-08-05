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
rm -rf node_modules
npm ci --production --ignore-scripts -w @tabulous/server
cd apps/server
tar --create --file ../../dist/server.tar.gz -z ../../node_modules/ src/ package.json 
cd ../..

# build games
cd apps/games
tar --create --file ../../dist/games.tar.gz -z *
cd ../..