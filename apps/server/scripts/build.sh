#!/bin/bash
set -x
rm -rf dist
rm -rf node_modules
npm install --production --no-package-lock
mkdir -p dist
tar --create --file dist/server.tar.gz --mode 600-z node_modules/ src/ games/ ../../.nvmrc package.json
cp scripts/deploy.sh dist/