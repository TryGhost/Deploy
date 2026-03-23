#!/bin/bash
set -e

# Generate SSH host keys if missing (Docker may not have them)
ssh-keygen -A

# Generate SSH keypair into shared volume if not already present
if [ ! -f /ssh-keys/id_ed25519 ]; then
    ssh-keygen -t ed25519 -f /ssh-keys/id_ed25519 -N ''
fi

# Set up authorized_keys for the deploy user
mkdir -p /home/deploy/.ssh
cp /ssh-keys/id_ed25519.pub /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Start sshd in foreground
exec /usr/sbin/sshd -D -e
