#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  exec gosu postgres "$0" "$@"
fi

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  if find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    echo "Reader volume is not empty and is not a PostgreSQL cluster. Use a fresh local volume." >&2
    exit 1
  fi
  pg_basebackup \
    --host="${PRIMARY_HOST:?PRIMARY_HOST is required}" \
    --username="${REPLICATION_USER:?REPLICATION_USER is required}" \
    --pgdata="$PGDATA" \
    --wal-method=stream \
    --write-recovery-conf \
    --progress
fi

exec docker-entrypoint.sh postgres -c hot_standby=on
