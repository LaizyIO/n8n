#!/bin/sh

# Gérer les certificats personnalisés si présents
if [ -d /opt/custom-certificates ]; then
  echo "Utilisation des certificats personnalisés depuis /opt/custom-certificates."
  export NODE_OPTIONS="--use-openssl-ca "
  export SSL_CERT_DIR=/opt/custom-certificates
  c_rehash /opt/custom-certificates
fi

# S'assurer que le dossier config a les bonnes permissions
if [ "1000" = "0" ]; then
  echo "Correction des permissions pour le dossier .n8n"
  mkdir -p /home/node/.n8n/config
  chown -R node:node /home/node/.n8n
  exec su-exec node n8n ""
fi

# Exécution normale en tant qu'utilisateur node
if [ "0" -gt 0 ]; then
  # Démarrage avec arguments
  exec n8n ""
else
  # Démarrage sans arguments
  exec n8n
fi
