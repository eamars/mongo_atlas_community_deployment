# MongoDB Atlas Local deployment

One `mongodb/mongodb-atlas-local:8.0` container runs both mongod and mongot (Atlas Search / Vector Search)
as a single-node replica set, which replaces the separate community `mongod` + `mongot` containers.

| Service         | Host port | Purpose                                                   |
|-----------------|-----------|-----------------------------------------------------------|
| `mongodb`       | 27027     | `mongodb://192.168.2.10:27027/?directConnection=true`     |
| `mongo-express` | 8082      | Web UI (basic auth from `.env`)                            |
| `mcp-server`    | 4003      | MongoDB MCP server (HTTP / SSE)                            |

The database has no client authentication. Data is kept in the named volumes `mongodb-atlas-data`,
`mongodb-atlas-config` and `mongodb-atlas-mongot`.

## Deploy

```bash
cp .env.example .env   # then set ME_BASICAUTH_PASSWORD
docker compose up -d
```

`mongo-express` and `mcp-server` start once the image's built-in healthcheck reports both mongod and mongot healthy.

## Migrating from the community deployment

Everything goes through client tools over the wire (`migrate/migrate.sh`, run on the docker host):

1. With the **old** stack still running: `bash migrate/migrate.sh dump`
   (writes `migrate/backup/dump.archive.gz` and `search-indexes.json`).
2. Stop the old stack: `docker compose down` in its directory.
3. Start this stack (see *Deploy*) and wait until `docker ps` shows `mongodb-atlas` as `healthy`.
4. `bash migrate/migrate.sh restore`. This restores the application databases, recreates the Search /
   Vector Search indexes and waits until they are queryable.

`admin`, `config`, `local` and `__mdb_internal_search` are not migrated. They only held the old deployment's
internals, such as the mongot user.

Once everything is verified, you can delete `/home/eamars/mongo_vector/` (old data and config files).
