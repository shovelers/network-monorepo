import { createHelia } from 'helia';
import { bitswap } from 'helia/block-brokers'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'

const STANDALONE = 1
const BROWSER = 2

async function createNode(type) {
  const blockstore = new MemoryBlockstore()
  const datastore = new MemoryDatastore()

  var libp2pconfig = {
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
      identify: identify(),
      ping: ping({
        maxInboundStreams: 100,
        maxOutboundStreams: 100,
        runOnTransientConnection: false,
      }),
    },
  }

  if (type == STANDALONE) {
    libp2pconfig.addresses = { listen: ['/ip4/0.0.0.0/tcp/0/ws'] }
  }

  const libp2p = await createLibp2p(libp2pconfig)
  
  
  return await createHelia({
    datastore,
    blockstore,
    libp2p,
    blockBrokers: [
      bitswap()
    ]
  })
}

export async function createStandaloneNode() {
  return await createNode(STANDALONE)
}

export async function createBrowserNode() {
  return await createNode(BROWSER)
}