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
cd apps/server
rm -rf dist
rm -rf node_modules
npm install --production --no-package-lock
tar --create --file ../../dist/server.tar.gz -z node_modules/ src/ games/ package.json 
cd ../..

