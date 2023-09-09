//Indexer to aggregate all the realtionships for a registry
//It should read events from the node and build a secondary storage

export async function getRegistry(regID, Heads, dag) {
  var rels = []
  for (const entry of Heads.entries()) {
    //get all keys that match the first part as regID
    if (entry[0].indexOf(regID) > -1) {
      var rel = await dag.get(entry[1])
      rels.push(rel.event)
    }
  }
  return rels
}

export function getFollowers(registryData, id) {
  var followerList = [];
  registryData.forEach(function (item, index) {
    if (item['to'] == id) {
      followerList.push(item['from']);
    }
  });

  return {data: followerList, count: followerList.length}
}

export function getFollowing(registryData, id) {
  var followingList = [];
  registryData.forEach(function (item, index) {
    if (item['from'] == id) {
      followingList.push(item['to']);
    }
  });

  return {data: followingList, count: followingList.length}
}
