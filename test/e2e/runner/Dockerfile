FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y openssh-client rsync && \
    rm -rf /var/lib/apt/lists/*

# Enable Corepack so the pnpm version pinned in package.json's
# packageManager field is provisioned for the project dependency install.
RUN corepack enable

WORKDIR /app
