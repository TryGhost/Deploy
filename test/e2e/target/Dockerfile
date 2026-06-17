FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y openssh-server rsync && \
    rm -rf /var/lib/apt/lists/*

# npm and yarn ship with the Node image; pnpm does not. A server deploying with
# packageManager: 'pnpm' must provide it, so install it here to mirror that.
RUN npm install -g pnpm@10.34.3

RUN mkdir /run/sshd

RUN useradd -m -s /bin/bash deploy && \
    passwd -d deploy && \
    mkdir -p /opt/deploy_to && \
    chown deploy:deploy /opt/deploy_to

COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 22

ENTRYPOINT ["/entrypoint.sh"]
