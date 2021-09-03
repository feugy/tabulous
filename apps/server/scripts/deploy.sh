#!/bin/bash
. ~/.nvm/nvm.sh
set -x
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