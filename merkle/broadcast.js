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
  console.log(relID)
  console.log(cid)
  console.log(heads)
  var localCID = heads.get(relID);
  console.log(localCID)
  //compare this cid to head cid
}

