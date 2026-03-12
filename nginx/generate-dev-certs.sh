#!/usr/bin/env bash
# Generates self-signed TLS certificates for local development.
# Run this once before starting Docker: bash nginx/generate-dev-certs.sh
#
# Requirements: openssl (available in Git Bash, WSL, or any Unix shell)
# Output: nginx/certs/localhost.crt and nginx/certs/localhost.key
#
# For production: replace these files with real certificates from your CA
# or use Let's Encrypt (certbot). The nginx.conf paths stay the same.

set -e

CERTS_DIR="$(cd "$(dirname "$0")/certs" && pwd)"

echo "Generating self-signed TLS certificate for localhost..."

# MSYS_NO_PATHCONV=1 prevents Git Bash on Windows from mangling the -subj path
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/localhost.key" \
  -out "$CERTS_DIR/localhost.crt" \
  -subj "/C=XX/ST=Dev/L=Dev/O=MyR Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

echo ""
echo "Done. Files created:"
echo "  $CERTS_DIR/localhost.crt"
echo "  $CERTS_DIR/localhost.key"
echo ""
echo "Browsers will show a security warning for self-signed certs."
echo "In Chrome: click 'Advanced' then 'Proceed to localhost'."
echo "To silence the warning permanently, import the .crt into your system's trusted root store."
echo ""
echo "Next step: docker-compose up --build -d"
