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
  - `sudo visudo`
  - add `tabulous ALL=NOPASSWD:/usr/bin/systemctl`
  - add `tabulous ALL=NOPASSWD:/usr/sbin/nginx`
- creates some folders:
  - `sudo su - tabulous`
  - `mkdir -m 700 nginx web server`

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

- copy the application files to the VPS:

  - nginx configuration: `scp hosting/tabulous.nginx tabulous@vps-XYZ.vps.ovh.net:~/nginx/tabulous`
  - SSL certificates: `scp -r hosting/certbot tabulous@vps-XYZ.vps.ovh.net:~/certbot`
  - UI files : `scp -r apps/web/dist tabulous@vps-XYZ.vps.ovh.net:~/web/dist`
  - server files : `scp apps/server/server.tar.gz tabulous@vps-XYZ.vps.ovh.net:~/server/`
  - systemD configuration : `scp hosting/tabulous.systemd ubuntu@vps-XYZ.vps.ovh.net:~/tabulous.service`

- install Nginx:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - get Nginx: `sudo apt install nginx-full -y`
  - stop it: `sudo nginx -s quit`
  - edits its configuration: `sudo vi /etc/nginx/nginx.conf`:
    - change `user www-data` to `user tabulous`
  - creates a symbolic link for tabulous NGINX site: `sudo ln -s /home/tabulous/nginx/tabulous /etc/nginx/sites-enabled/tabulous`
  - removes default NGINX site: `sudo rm /etc/nginx/sites-enabled/default`

- install NVM and Node.js:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - gets Node Version Manager: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash`
  - makes nvm command available: `source ~/.bashrc`

- install Certbot:

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - get certbot snap: `sudo snap install --classic certbot`
  - make it executable: `sudo ln -s /snap/bin/certbot /usr/bin/certbot`
  - give it authorizations: `sudo snap set certbot trust-plugin-with-root=ok`
  - install certbot OVH DNS plugin: `sudo snap install certbot-dns-ovh`

- run the application server

  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - move SystemD configuration to the proper place: `sudo mv ~/tabulous.service /etc/systemd/system`
  - enable it: `sudo systemctl enable tabulous`
  - endorse Tabulous user: `sudo su - tabulous`
  - move to the server folder: `cd ~/server`
  - unzip the code: `tar -xzf server.tar.gz`
  - secure access: `chmod -R og= .`
  - use the right Node.js version: `nvm install`
  - make start.sh executable: `chmod u+x start.sh`

- start everything!
  - open an SSH connection to the VPS: `ssh ubuntu@vps-XYZ.vps.ovh.net`
  - start tabulous server: `sudo systemctl start tabulous`
  - start Nginx: `sudo nginx`

## Continuous deployment

[Source](https://coderflex.com/blog/2-easy-steps-to-automate-a-deployment-in-a-vps-with-github-actions)

- Authorize Gihub action
  - open an SSH connection to the VPS _as tabulous_: `ssh tabulous@vps-XYZ.vps.ovh.net`
  - makes an SSH key \_with no passphrase and github email: `ssh-keygen -t rsa -b 4096 -C "your@email.com"`
  - authorize it: `cat .ssh/id_rsa.pub >> .ssh/authorized_keys`
  - in Gihub [repository settings](https://github.com/feugy/tabulous/settings/secrets/actions):
    - add `DEPLOY_HOST` secret and set it to `vps-XYZ.vps.ovh.net`
    - add `DEPLOY_PORT` secret and set it to `22`
    - add `DEPLOY_USERNAME` secret and set it to `tabulous`
    - add `DEPLOY_SSH_KEY` secret and set it to the exact content of `.ssh/id_rsa`

_Hints_

Tail server logs: `journalctl -f -u tabulous`
Tail nginx logs: `tail -f /var/log/nginx/access.log`
