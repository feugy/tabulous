#!/bin/bash
# it assumes being ran in the repo root folder
# it assumes KEY, HOST, PORT and USER env variables
set -x

mkdir -p ~/.ssh/
echo "$KEY" > ~/.ssh/vps.key
chmod 600 ~/.ssh/vps.key
cat >>~/.ssh/config <<END
Host vps
  HostName $HOST
  Port $PORT
  User $USER
  IdentityFile ~/.ssh/vps.key
  StrictHostKeyChecking no
END
          
scp -r dist vps:~/
ssh vps '~/dist/deploy.sh'