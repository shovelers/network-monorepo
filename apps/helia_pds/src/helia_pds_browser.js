import { createHelia } from 'helia';
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { multiaddr } from 'multiaddr'

async function dial(peer){
  await node.libp2p.dial(multiaddr(peer));
  console.log("latency:", latency)
};

async function createNode () {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore()

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore()

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    transports: [webSockets()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
  })

  return await createHelia({
    datastore,
    blockstore,
    libp2p
  })
}

export { createNode, dial }