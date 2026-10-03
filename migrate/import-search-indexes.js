// Recreates the Search / Vector Search indexes from /backup/search-indexes.json and waits until
// each one is queryable (mongot builds them from the restored data).
const fs = require('fs');

const TIMEOUT_MS = 30 * 60 * 1000;
const POLL_MS = 5000;

const indexes = EJSON.parse(fs.readFileSync('/backup/search-indexes.json', 'utf8'));

const findIndex = ({ db: dbName, collection, name }) =>
  db.getSiblingDB(dbName).getCollection(collection)
    .aggregate([{ $listSearchIndexes: { name } }]).toArray()[0];

for (const index of indexes) {
  const label = `${index.type} index ${index.db}.${index.collection}/${index.name}`;
  if (findIndex(index)) {
    print(`Exists:  ${label}`);
    continue;
  }
  db.getSiblingDB(index.db).runCommand({
    createSearchIndexes: index.collection,
    indexes: [{ name: index.name, type: index.type, definition: index.definition }],
  });
  print(`Created: ${label}`);
}

const deadline = Date.now() + TIMEOUT_MS;
let pending = indexes;
while (pending.length > 0) {
  pending = pending.filter((index) => {
    const current = findIndex(index);
    if (current?.status === 'FAILED') {
      throw new Error(`Index ${index.db}.${index.collection}/${index.name} failed: ${EJSON.stringify(current)}`);
    }
    return !current?.queryable;
  });
  if (pending.length === 0) break;
  if (Date.now() > deadline) {
    throw new Error(`Timed out waiting for: ${pending.map((i) => `${i.db}.${i.collection}/${i.name}`).join(', ')}`);
  }
  print(`Waiting for ${pending.length} index(es) to become queryable...`);
  sleep(POLL_MS);
}

print(`All ${indexes.length} search index(es) are queryable`);
