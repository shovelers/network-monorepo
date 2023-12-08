import { createHelia } from 'helia';
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import * as filters from '@libp2p/websockets/filters'
import { unixfs } from '@helia/unixfs'

const node = await createNode()
const multiaddrs = node.libp2p.getMultiaddrs()
console.log("node address:", multiaddrs);

const fs = unixfs(node)

// we will use this TextEncoder to turn strings into Uint8Arrays
const encoder = new TextEncoder()

// add the bytes to your node and receive a unique content identifier
const cid = await fs.addBytes(encoder.encode('Hello World 101'), {
  onProgress: (evt) => {
    console.info('add event', evt.type, evt.detail)
  }
})

console.log('Added file:', cid.toString())

// this decoder will turn Uint8Arrays into strings
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

async function createNode () {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore()

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore()

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0/ws']
    },
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