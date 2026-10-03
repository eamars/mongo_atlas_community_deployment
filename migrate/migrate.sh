#!/usr/bin/env bash
# Logical migration between deployments using client tools only (mongodump / mongorestore / mongosh,
# run from a throwaway mongo:8.0 container). Neither server's data files are touched.
#
#   bash migrate/migrate.sh dump      # read from the OLD deployment while it is still running
#   bash migrate/migrate.sh restore   # write into the NEW Atlas Local deployment once it is healthy
#
# Override endpoints with SOURCE_URI / TARGET_URI. Both default to the same host port, since the
# new stack replaces the old one on 27027.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backup}"
SOURCE_URI="${SOURCE_URI:-mongodb://192.168.2.10:27027/?directConnection=true}"
TARGET_URI="${TARGET_URI:-mongodb://192.168.2.10:27027/?directConnection=true}"
TOOLS_IMAGE="${TOOLS_IMAGE:-mongo:8.0}"

# Databases that belong to the old deployment's internals, not to the application:
# admin (incl. the mongot/searchCoordinator user), config, local, and community search metadata.
EXCLUDES=(
  --nsExclude='admin.*'
  --nsExclude='config.*'
  --nsExclude='local.*'
  --nsExclude='__mdb_internal_search.*'
)

run_client() {
  docker run --rm --network host \
    --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$BACKUP_DIR:/backup" \
    -v "$SCRIPT_DIR:/scripts:ro" \
    "$TOOLS_IMAGE" "$@"
}

case "${1:-}" in
  dump)
    mkdir -p "$BACKUP_DIR"
    run_client mongodump --uri="$SOURCE_URI" --archive=/backup/dump.archive.gz --gzip
    run_client mongosh "$SOURCE_URI" --quiet --file /scripts/export-search-indexes.js
    echo "Dump written to $BACKUP_DIR"
    ;;
  restore)
    [[ -f "$BACKUP_DIR/dump.archive.gz" ]] || { echo "No dump in $BACKUP_DIR; run 'dump' first" >&2; exit 1; }
    # --drop makes a re-run replace collections instead of failing on duplicate keys.
    run_client mongorestore --uri="$TARGET_URI" --archive=/backup/dump.archive.gz --gzip --drop "${EXCLUDES[@]}"
    run_client mongosh "$TARGET_URI" --quiet --file /scripts/import-search-indexes.js
    ;;
  *)
    echo "usage: $0 dump|restore" >&2
    exit 2
    ;;
esac
