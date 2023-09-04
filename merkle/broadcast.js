import { CID } from 'multiformats/cid'

export function broadcast(node, topic, relID, data) {
  console.log(JSON.stringify({relID: relID, cid: data}))
  node.libp2p.services.pubsub.publish(topic, new TextEncoder().encode(JSON.stringify({relID: relID, cid: data}))).catch(err => {
    console.error(err)
  })
}

export async function eventProcessor(dag, data, heads) {
  var cid = CID.parse(JSON.parse(data)["cid"]["/"]);
  console.log("Input CID:", cid)
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
  let intersection = completeEventDAG.filter(x => completeLocalDAG.includes(x));
  //check if local < event, keep event as head
  if (completeEventDAG.includes(headCID.toString())) {
    return cid
  //check if event < local, keep local as head
  }
  else if (completeLocalDAG.includes(cid.toString())) {
    return headCID
  }
  //check for divergence
  //else if (intersection){
  //create new state by merging cid & headCID
  //attach as a new node in local dag with link containing both cid & headCID
  //publish this event
  //}
}

//redimentary walker, doesn't do proper DFS, use https://github.com/multiformats/js-multiformats#traversal
async function cborWalker(dag, cid, seen) {
  var seen = seen || []
  if (seen.includes(cid.toString())) {
    return
  }
  if (cid) {
    seen.push(cid.toString())
    var data = await dag.get(cid);
    var links = data.link
    if (links !== undefined ) { links.forEach(async (link) => await cborWalker(dag, link, seen)) }
  }
  return seen
}
