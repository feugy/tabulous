# Hosting

Tabulous is currently hosted on Virtual Private Server (VPS) at OVH, running Ubuntu 20

Here are the various configuration and modification applied.

## Security

[Further reading](https://docs.ovh.com/fr/vps/conseils-securisation-vps/)

Please note that IPv6 is not enabled by default.
First commands will need to connect with IPv4 (hence the `-4` flag) in the meantime, and to provide the password you received by email.

- open an SSH connection to the VPS: `ssh -4 ubuntu@vps-XYZ.vps.ovh.net`
- update packages and system
  ```shell
  sudo apt-get update -y
  sudo apt-get upgrade -y
  ```
- set `root` password with `sudo passwd`
- change `ubuntu` password with `passwd`
- prevent SSH access with root user
  - `sudo vi /etc/ssh/sshd_config`
  - add or change `PermitRootLogin no`
  - `sudo systemctl restart sshd`
- add technical user `tabulous` for running the app: `sudo adduser tabulous`
- grant it the right to restart services:
  - open sudoer configuration file: `sudo visudo`
  - add: `tabulous ALL=NOPASSWD:/usr/bin/systemctl`
  - add: `tabulous ALL=NOPASSWD:/usr/bin/journalctl`
  - add: `tabulous ALL=NOPASSWD:/usr/sbin/nginx`

## Connectivity

[Further reading](https://docs.ovh.com/fr/vps/configurer-ipv6/#en-pratique)

- enables IPv6 address:
  - open an SSH connection to the VPS: `ssh -4 ubuntu@vps-XYZ.vps.ovh.net`
  - add new netplan configuration: `sudo vi /etc/netplan/51-cloud-init-ipv6.yaml`
  - set content (beware: 4 spaces, no tabs):
    ```
    network:
        version: 2
        ethernets:
            eth0:
                dhcp6: no
                match:
                    name: eth0
                addresses:
                - "2001:41d0:304:200::a988/64"
                gateway6: "2001:41d0:304:200::1"
                routes:
                -   to: "2001:41d0:304:200::1"
                    scope: link
    ```
  - validate the new configuration: `sudo netplan try`
  - apply it: `sudo netplan apply`
  - DO NOT CLOSE SSH: open another ssh, and try connecting with ssh -6. If it fails, you can always recover your configuration on the previous connection
- authorize your SSH key (from your machine):
  - `ssh-copy-id ubuntu@vps-XYZ.vps.ovh.net`
  - `ssh-copy-id tabulous@vps-XYZ.vps.ovh.net`

## Software

- Copy SSL certificates: `scp -r hosting/certbot tabulous@vps-XYZ.vps.ovh.net:~/certbot`

- install Nginx:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - get Nginx: `sudo apt install nginx-full -y`
  - stop it: `sudo nginx -s quit`
  - edits its configuration: `sudo vi /etc/nginx/nginx.conf`
    - change `user www-data` to `user tabulous`
  - removes default NGINX site: `sudo rm /etc/nginx/sites-enabled/default`
  - creates a symbolic link for tabulous NGINX site: `sudo ln -s /home/tabulous/nginx/tabulous /etc/nginx/sites-enabled/tabulous`

- prepare SystemD configuration for tabulous server:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - creates a symbolic link for tabulous service definition: `sudo ln -s /home/tabulous/systemd/tabulous.service /etc/systemd/system/tabulous.service`

- install NVM and Node.js:

  - open an SSH connection to the VPS _as tabulous_: `ssh tabulous@vps-XYZ.vps.ovh.net`
  - gets Node Version Manager: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash`
  - makes nvm command available: `source ~/.bashrc`

- install Certbot:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - get certbot snap: `sudo snap install --classic certbot`
  - make it executable: `sudo ln -s /snap/bin/certbot /usr/bin/certbot`
  - give it authorizations: `sudo snap set certbot trust-plugin-with-root=ok`
  - install certbot OVH DNS plugin: `sudo snap install certbot-dns-ovh`
  - get 1h credentials from [OVH DNS](https://eu.api.ovh.com/createToken/), using your OVH ID and password, naming the script 'certbot' and allowing GET+PUT+POST+DELETE on `/domain/zone/*`
  - save the credentials in an `certbot/ovh.ini` file:

    ```shell
    dns_ovh_endpoint = ovh-eu
    dns_ovh_application_key = AkG1LEDihK0AEP9g
    dns_ovh_application_secret = k1oYVImXc3YQYxwA3DTUc2Ch6oI7stXN
    dns_ovh_consumer_key = KVw37RY59KXOrinnLEO1QIMSC7Dec0ST
    ```

  - configure for Nginx: `sudo certbot --nginx` then:
    1.  provide email
    1.  accept terms of service
    1.  decline sharing email address
    1.  allow all domains

- install coTurn ([source](https://medium.com/@helderjbe/setting-up-a-turn-server-with-node-production-ready-8f4a4c36e64d)):

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - update apt and install coTurn: `sudo apt-get -y update` & `sudo apt-get -y install coturn`
  - enable as a service: `echo 'TURNSERVER_ENABLED=1' | sudo tee /etc/default/coturn`
  - generate some random secret value (save it somewhere): `openssl rand -base64 32`
  - edits its configuration: `sudo vi /etc/turnserver.conf`
    - uncomment `#fingerprint`
    - uncomment `#use-auth-secret`
    - provide your new secret value for `static-auth-secret=[SECRET]`
    - uncomment `#realm=[DOMAIN]` and change domain value for `tabulous.fr`
    - uncomment `#total-quota=0` and change value for `100`
    - uncomment `#no-multicast-peers`
    - uncomment `#cert=[PATH]` and change path value for `/home/tabulous/certbot/live/tabulous.fr/fullchain.pem`
    - uncomment `#pkey=[PATH]` and change path value for `/home/tabulous/certbot/live/tabulous.fr/privkey.pem`
  - restart service: `sudo systemctl restart coturn`

- install Redis 7+:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - configure Redis PPA:
    - `curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg`
    - `echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list`
    - `sudo apt-get update`
  - install Redis: `sudo apt install -y redis`
  - configure redis:
    1. `sudo vi /etc/redis/redis.conf`
    1. uncomment line `aclfile /etc/redis/users.acl`
    1. save and quit
    1. generate 2 random secrets values (save them somewhere): `tr -cd '[:alnum:]' < /dev/urandom | fold -w30 | head -n 2`
    1. add these:
       - `user default off`
       - `user USERNAME on allkeys +@keyspace +@list +@set +@sortedset +@hash +@string +@transaction >PASSWORD_1`
       - `user USERNAME_2 on allchannels +@pubsub >PASSWORD_2`
    1. save and quit
  - restart redis to apply changes: `sudo systemctl restart redis`

- install rsnapshot

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - install rsnapshot: `sudo apt install -y rsnapshot`
  - edit the configuration file:
    1. `sudo vi /etc/rsnapshot.conf` (beware: use tabs between keys and their values)
    1. set `snapshot_root /home/ubuntu/backup/`
    1. uncomment `no_create_root`
    1. set the following retain intervals: `retain hourly 24` `retain daily 7` and `retain monthly 3`
    1. at the end keep a single backup point: `backup /var/lib/redis ./`
  - set cron jobs:
    1. open cron table in the editor of your choice: `sudo crontab -e`
    1. add these jobs: `0 * * * * sudo /usr/bin/rsnapshot hourly`, `0 0 * * * sudo /usr/bin/rsnapshot daily` and `0 0 1 * * sudo /usr/bin/rsnapshot monthly`

- install Gitea (original [documentation](https://docs.gitea.io/en-us/install-from-binary/)):

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - creates an nginx configuration: `sudo vi /etc/nginx/sites-enabled/gitea`
  - sets content to /hosting/gitea.nginx file from this repo
  - restart nginx `sudo systemctl restart nginx`
  - download gitea: `wget -O gitea https://dl.gitea.io/gitea/1.17.4/gitea-1.17.4-linux-amd64`
  - make it executable: `sudo chmod +x gitea`
  - create a system user: `sudo adduser --system --shell /bin/bash --gecos 'Git Version Control' --group --disabled-password --home /home/git git`
  - create working repositories:
    - `sudo mkdir -p /var/lib/gitea/{custom,data,log}`
    - `sudo mkdir /etc/gitea`
  - grant them ownership:
    - `sudo chown -R git:git /var/lib/gitea/`
    - `sudo chmod -R 750 /var/lib/gitea/`
    - `sudo chown root:git /etc/gitea`
    - `sudo chmod 770 /etc/gitea`
  - move the executable to its final place: `sudo cp gitea /usr/local/bin/gitea`
  - create a service file: `sudo vi /etc/systemd/system/gitea.service`
  - set its content to [this](https://github.com/go-gitea/gitea/blob/main/contrib/systemd/gitea.service)
  - append `-p 9000` to the `ExecStart` command
  - enable service: `sudo systemctl enable gitea`
  - start service: `sudo systemctl start gitea`
  - browse to the service configuration page: http://vps-XYZ.vps.ovh.net:9000/
    - select SQLite3 database
    - change title to `Gitea for Tabulous`
    - set base url to `https://gitea.tabulous.fr/`
    - configure local only
    - expand server parameters and make sure only these are checked:
      - `Enable unified avatars`
      - `Disable registration form`
      - `Require account registration to display pages`
      - `Allow default organization creation`
      - `Enable time tracking`
    - expand admin account parameters and fill out the details
    - click on `Install Gitea`
    - once logged, add ssh key to the SSH/GPG keys list in /user/settings/keys
  - tweak gitea server configuration: `sudo vi /etc/gitea/app.ini`
    - set `SSH_DOMAIN` and `DOMAIN` to `gitea.tabulous.fr`
    - look for `[actions]` and set `ENABLED` to `true`
  - restrict permissions after installation:
    - `sudo chmod 750 /etc/gitea`
    - `sudo chmod 640 /etc/gitea/app.ini`
  - restart `sudo systemctl restart gitea`
  - give the user access to tabulous folders: `sudo usermod -G tabulous,git git`
  - open sudoer configuration file: `sudo visudo`
    - add: `git      ALL=NOPASSWD:/usr/bin/systemctl`

## Continuous deployment

[Inspiration](https://coderflex.com/blog/2-easy-steps-to-automate-a-deployment-in-a-vps-with-github-actions)
[Github action and SSH commands](https://blog.benoitblanchon.fr/github-action-run-ssh-commands/)

- Authorize Gihub action
  - open an SSH connection to the VPS _as tabulous_: `ssh tabulous@vps-XYZ.vps.ovh.net`
  - makes an SSH key \_with no passphrase and github email: `ssh-keygen -t rsa -b 4096 -C "your@email.com"`
  - authorize it: `cat .ssh/id_rsa.pub >> .ssh/authorized_keys`
  - in Gihub [repository settings](https://github.com/feugy/tabulous/settings/secrets/actions):
    - add `DEPLOY_HOST` secret and set it to `vps-XYZ.vps.ovh.net`
    - add `DEPLOY_PORT` secret and set it to `22`
    - add `DEPLOY_USERNAME` secret and set it to `tabulous`
    - add `DEPLOY_SSH_KEY` secret and set it to the exact content of `.ssh/id_rsa`

The `CD` github workflow will trigger after a successful run of `CI` workflow, on main branch.
It can also be manually triggered from the [Github action interface](https://github.com/feugy/tabulous/actions/workflows/CD.yml)

_Hints_

Tail server logs: `journalctl -f -u tabulous -o cat | jq`
Tail nginx logs: `tail -f /var/log/nginx/access.log`
Clean logs: `sudo journalctl --vacuum-time=2months`

## Tabulous Configuration

Tabulous server runs with sensible defaults, but still needs some configuration through environment variables.
Because such configuration should not be commited on Github, it is stored in an `.env` file

- open an SSH connection to the VPS _as tabulous_: `ssh tabulous@vps-XYZ.vps.ovh.net`

- edit profile: `vi ~/?bashrc`

  - add `export NODE_ENV=production` at the end
  - save and reload: `source ~/.bashrc`

- generate some random secret value (save it somewhere): `openssl rand -base64 32`
- edit configuration file: `vi ~/server/.env`

  - add `NODE_ENV=production`
  - add `JWT_KEY=[SECRET]` with the secret you just generated
  - add `TURN_SECRET=[SECRET]` with the same secret value as coTURN's `static-auth-secret`
  - add `REDIS_URL=redis://[USER]:[SECRET]@localhost:6379` with the first user and secret from `/etc/redis/users.acl`
  - add `PUBSUB_URL=redis://[USER]:[SECRET]@localhost:6379` with the second user and password from `/etc/redis/users.acl`

## Rotating backup

Create an hourly backup
@hourly rsync -a /var/lib/redis/dump.rdb ~/backup/dump.`date +%y%m%d-%h%m`.rdb
@daily rsync -a /var/lib/redis/dump.rdb ~/backup/dump.`date +%y%m%d`.rdb

## Maintenance

1. update all packages:
   ```sh
   sudo apt dist-upgrade -y
   ```
1. renew SSH certificates
   ```sh
   sudo certbot renew
   ```
1. disk used by backups:
   ```sh
   sudo rsnapshot du
   ```
1. updating [gitea](https://docs.gitea.com/next/installation/install-from-binary#updating-to-a-new-version):
   ```sh
   sudo systemctl stop gitea
   sudo su git
   cd ~
   mkdir tmp
   gitea dump -c /etc/gitea/app.ini -t ~/tmp -w ~
   exit
   wget -O gitea https://dl.gitea.io/gitea/1.20/gitea-1.20-linux-amd64
   sudo chmod +x gitea
   sudo cp gitea /usr/local/bin/gitea
   sudo systemctl start gitea
   ```
