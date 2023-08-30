import { CID } from 'multiformats/cid'

export function broadcast(node, topic, data) {
  node.libp2p.services.pubsub.publish(topic, new TextEncoder().encode(data)).catch(err => {
    console.error(err)
  })
}

export function eventProcessor(dag, event) {
  var cid = CID.parse(event);
  console.log(cid)
  //compare this cid to head cid
}

