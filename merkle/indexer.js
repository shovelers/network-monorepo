//Indexer to aggregate all the realtionships for a registry
//It should read events from the node and build a secondary storage

export async function getRegistry(regID, Heads, dag) {
  var rels = []
  for (const entry of Heads.entries()) {
    console.log(`${entry[0]}: ${entry[1]}`);
    //get all keys that match the first part as regID
    if (entry[0].indexOf(regID) > -1) {
      var rel = await dag.get(entry[1])
      rels.push(rel.event)
    }
  }
  return rels
}
