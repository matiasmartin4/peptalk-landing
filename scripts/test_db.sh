#!/bin/sh
# Prueba la migración y los permisos por rol en un Postgres local (sin Docker):
# simula lo mínimo de Supabase (auth.uid, storage, roles anon/authenticated).
set -e
cd "$(dirname "$0")/.."
dropdb --if-exists pt_test >/dev/null 2>&1
createdb pt_test
psql -q -v ON_ERROR_STOP=1 -d pt_test -c "create extension pgcrypto" -f supabase/tests/supabase_stub.sql \
  $(ls supabase/migrations/*.sql | sed 's/^/-f /') -f supabase/seed.sql 2>&1 | grep -v NOTICE || true
psql -d pt_test -f supabase/tests/permisos.sql 2>&1 | grep -E "PASA|FALLA|ERROR" | sed 's/.*NOTICE:  //'
dropdb pt_test
