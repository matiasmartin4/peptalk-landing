#!/bin/sh
# Sube la configuración de auth (SMTP de Resend + plantillas en castellano) al proyecto.
# La clave de Resend se lee de ~/.peptalk-resend-key; nunca entra al repo.
set -e
cd "$(dirname "$0")/.."
KEY_FILE="$HOME/.peptalk-resend-key"
[ -s "$KEY_FILE" ] || { echo "Falta $KEY_FILE con la API key de Resend"; exit 1; }
RESEND_API_KEY="$(tr -d '[:space:]' < "$KEY_FILE")" supabase config push --project-ref ksclxrhwaeddlxrdnfxi --yes
