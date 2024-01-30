import { createHelia } from 'helia';
import { bitswap } from 'helia/block-brokers'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { multiaddr } from '@multiformats/multiaddr'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC } from '@libp2p/webrtc'
import { dcutr } from '@libp2p/dcutr'

export const STANDALONE = 1
const BROWSER = 2

export async function createNode(type, blockstore, datastore, config) {
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
    connectionManager: {
      minConnections: 0
    }
  }

  if (type == STANDALONE) {
    libp2pconfig.addresses = { listen: ['/ip4/0.0.0.0/tcp/3001/ws'] }
    libp2pconfig.services.pubsub = gossipsub({ allowPublishToZeroPeers: true })
    libp2pconfig.services.relay = circuitRelayServer({reservations: {maxReservations: Infinity}})
    //libp2pconfig.metrics = config.metrics
  }

  if (type == BROWSER) {
    libp2pconfig.addresses = { listen: ['/webrtc']}
    libp2pconfig.transports.push(webRTC())
    libp2pconfig.transports.push(circuitRelayTransport({discoverRelays: 1}))
    libp2pconfig.services.pubsub = gossipsub({ allowPublishToZeroPeers: true })
    libp2pconfig.services.dcutr = dcutr()
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

export async function createBrowserNode() {
  const blockstore = new IDBBlockstore('blockstore/shovel')
  await blockstore.open()

  const datastore = new IDBDatastore('datastore/shovel')
  await datastore.open()

  return await createNode(BROWSER, blockstore, datastore)
}

export async function dial(node, peer) {
  console.log("dialing", peer)
  const connection = await node.libp2p.dial(multiaddr(peer));
  const latency = await node.libp2p.services.ping.ping(multiaddr(peer))
  console.log("latency:", latency)
};