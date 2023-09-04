import { CID } from 'multiformats/cid'

export function broadcast(node, topic, relID, data) {
  console.log(JSON.stringify({relID: relID, cid: data}))
  node.libp2p.services.pubsub.publish(topic, new TextEncoder().encode(JSON.stringify({relID: relID, cid: data}))).catch(err => {
    console.error(err)
  })
}

export async function eventProcessor(dag, data, heads) {
  var cid = CID.parse(JSON.parse(data)["cid"]["/"]);
  var relID = JSON.parse(data)["relID"];
  var headCID = heads.get(relID);
  console.log("localCID:", headCID)
  if (typeof headCID === 'undefined'){
    heads.set(relID, cid)
  } else if ( headCID == cid) {
    return
  } else {
    var result = await compareDAGs(dag, cid, headCID)
    heads.set(relID, result)
    console.log("head set as:", result)
  }
}

async function compareDAGs(dag, cid, headCID) {
  //walk both dags
  //compare this cid to head cid
  var completeEventDAG = await cborWalker(dag, cid)
  console.log("EventDAG:", completeEventDAG)
  console.log("event cid:", cid)
  var completeLocalDAG = await cborWalker(dag, headCID)
  console.log("localDAG:", completeLocalDAG)
  console.log("headCID:", headCID)
  //check if local < event, keep event as head
  if (completeEventDAG.includes(headCID.toString())) {
    return cid
  //check if event < local, keep local as head
  }
  else if (completeLocalDAG.includes(cid.toString())) {
    return headCID
  }
}

async function cborWalker(dag, cid) {
  const cids = []
  let id = cid
  while (id) {
    cids.push(id.toString())
    var data = await dag.get(id);
    var link = data.link
    id = link
  }
  return cids
}
