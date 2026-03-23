FROM node:18-bullseye

RUN apt-get update && \
    apt-get install -y openssh-client rsync && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
