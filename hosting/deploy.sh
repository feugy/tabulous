#!/bin/bash
# it assumes being ran in /home/tabulous
. ~/.nvm/nvm.sh
set -x

# creates folders if necessary
mkdir -p ~/nginx
mkdir -p ~/systemd
mkdir -p ~/server
mkdir -p ~/games
mkdir -p ~/node_modules/@tabulous

# move configuration files
mv -f ~/dist/tabulous.nginx ~/nginx/tabulous
mv -f ~/dist/tabulous.systemd ~/systemd/tabulous.service
mv -f ~/dist/start.sh ~/server
mv -f ~/dist/.nvmrc ~/server

# unpack files
tar -x --file ~/dist/server.tar.gz -z --directory ~/server
tar -x --file ~/dist/games.tar.gz -z --directory ~/games

# creates modules internal links
cd ~/node_modules/@tabulous/
ln -s ~/server server

# ensures correct Node.js version
cd ~/server
set +x
nvm install
set -x

# run migrations
cd ~/server
node migrations

# restart all
sudo nginx -s reload
sudo systemctl daemon-reload 
sudo systemctl enable tabulous
sudo systemctl restart tabulous