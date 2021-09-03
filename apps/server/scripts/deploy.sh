#!/bin/bash
. ~/.nvm/nvm.sh
set -x
cd /home/tabulous/server
tar -x --file server.tar.gz -z
set +x
nvm install
set -x
cat << EOF > start.sh
#!/bin/bash
. ~/.nvm/nvm.sh
node .
EOF
chmod 700 start.sh
sudo systemctl restart tabulous
