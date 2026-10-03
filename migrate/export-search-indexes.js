// Exports every Search / Vector Search index definition to /backup/search-indexes.json.
// mongodump does not carry search indexes, so they are recreated separately on restore.
const fs = require('fs');

const SKIP_DBS = ['admin', 'config', 'local', '__mdb_internal_search'];
const exported = [];

for (const { name: dbName } of db.adminCommand({ listDatabases: 1, nameOnly: true }).databases) {
  if (SKIP_DBS.includes(dbName)) continue;
  const database = db.getSiblingDB(dbName);

  for (const { name: collection } of database.getCollectionInfos({ type: 'collection' })) {
    if (collection.startsWith('system.')) continue;

    const indexes = database.getCollection(collection).aggregate([{ $listSearchIndexes: {} }]).toArray();
    for (const index of indexes) {
      exported.push({
        db: dbName,
        collection,
        name: index.name,
        type: index.type ?? 'search',
        definition: index.latestDefinition,
      });
      print(`Found ${index.type ?? 'search'} index ${dbName}.${collection}/${index.name}`);
    }
  }
}

fs.writeFileSync('/backup/search-indexes.json', EJSON.stringify(exported, null, 2));
print(`Exported ${exported.length} search index definition(s)`);
