#!/bin/bash
. ~/.nvm/nvm.sh
trap 'kill 0' exit
node .
wait