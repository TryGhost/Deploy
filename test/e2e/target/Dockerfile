FROM node:18-bullseye

RUN apt-get update && \
    apt-get install -y openssh-server rsync && \
    rm -rf /var/lib/apt/lists/*

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
