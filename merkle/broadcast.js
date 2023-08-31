import { CID } from 'multiformats/cid'

export function broadcast(node, topic, relID, data) {
  console.log(JSON.stringify({relID: relID, cid: data}))
  node.libp2p.services.pubsub.publish(topic, new TextEncoder().encode(JSON.stringify({relID: relID, cid: data}))).catch(err => {
    console.error(err)
  })
}

export function eventProcessor(dag, data, heads) {
  var cid = CID.parse(JSON.parse(data)["cid"]["/"]);
  var relID = JSON.parse(data)["relID"];
  var headCID = heads.get(relID);
  console.log("localCID:", headCID)
  if (typeof headCID === 'undefined'){
    heads.set(relID, cid)
  } else {
    return
  }
  //compare this cid to head cid
}

