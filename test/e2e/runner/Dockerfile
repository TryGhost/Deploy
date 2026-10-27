FROM node:22.23.4-bookworm@sha256:63538dfe497cc29dfafdda25ada09b46db68a3f4cc205abf1f5d6bf0913f3384

RUN apt-get update && \
    apt-get install -y openssh-client rsync && \
    rm -rf /var/lib/apt/lists/*

# Enable Corepack so the pnpm version pinned in package.json's
# packageManager field is provisioned for the project dependency install.
RUN corepack enable

WORKDIR /app
