#!/bin/bash
. ~/.nvm/nvm.sh
nvm use
trap 'kill 0' exit
node .
wait