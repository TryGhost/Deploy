FROM node:22.22.0-bookworm@sha256:20a424ecd1d2064a44e12fe287bf3dae443aab31dc5e0c0cb6c74bef9c78911c

RUN apt-get update && \
    apt-get install -y openssh-client rsync && \
    rm -rf /var/lib/apt/lists/*

# Enable Corepack so the pnpm version pinned in package.json's
# packageManager field is provisioned for the project dependency install.
RUN corepack enable

WORKDIR /app
