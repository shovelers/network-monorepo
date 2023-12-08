import { createHelia } from 'helia';
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { multiaddr } from 'multiaddr'
import * as filters from '@libp2p/websockets/filters'
import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats/cid'

async function writeFile(node, data) {
  const fs = unixfs(node)
  const encoder = new TextEncoder()
  const cid = await fs.addBytes(encoder.encode(data), {
    onProgress: (evt) => {
      console.info('add event', evt.type, evt.detail)
    }
  })
  console.log('Added file:', cid.toString())
}

async function readFile(node, cid){
  const fs = unixfs(node)
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of fs.cat(cid, {
    onProgress: (evt) => {
      console.info('cat event', evt.type, evt.detail)
    }
  })) {
    text += decoder.decode(chunk, {
      stream: true
    })
  }
  console.log('Added file contents:', text)
}

async function dial(node, peer){
  const connection = await node.libp2p.dial(multiaddr(peer));
  const latency = await node.libp2p.services.ping.ping(multiaddr(peer))
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
    transports: [webSockets({filter: filters.all})],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: async (multiAddr) => {
        const str = multiAddr.toString()
        return !str.includes("/ws/") && !str.includes("/wss/") && !str.includes("/webtransport/")
      },
    },
    services: {
      ping: ping({
        maxInboundStreams: 100,
        maxOutboundStreams: 100,
        runOnTransientConnection: false,
      }),
    },
  })

  return await createHelia({
    datastore,
    blockstore,
    libp2p
  })
}

export { createNode, dial, multiaddr, writeFile, readFile, CID }