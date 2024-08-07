import { createHelia } from 'helia';
import { bitswap } from 'helia/block-brokers'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { multiaddr } from '@multiformats/multiaddr'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC } from '@libp2p/webrtc'
import { dcutr } from '@libp2p/dcutr'

export const HUB = 1
export const BROWSER = 2
export const APP = 3

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

  if (type == HUB) {
    libp2pconfig.addresses = { listen: ['/ip4/0.0.0.0/tcp/3001/ws'] }
    libp2pconfig.services.pubsub = gossipsub({ })
    libp2pconfig.services.relay = circuitRelayServer({reservations: {maxReservations: Infinity}})
    //libp2pconfig.metrics = config.metrics
  }

  if (type == BROWSER) {
    libp2pconfig.addresses = { listen: ['/webrtc']}
    libp2pconfig.transports.push(webRTC())
    libp2pconfig.transports.push(circuitRelayTransport({discoverRelays: 1}))
    libp2pconfig.services.pubsub = gossipsub({ allowPublishToZeroPeers: false })
    libp2pconfig.services.dcutr = dcutr()
  }

  if (type == APP) {
    libp2pconfig.addresses = { listen: ['/ip4/0.0.0.0/tcp/3002/ws'] }
    libp2pconfig.services.pubsub = gossipsub({ })
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

export async function dial(helia, addressStr) {
  const address = multiaddr(addressStr)
  const peerId = address.getPeerId()

  let connection = helia.libp2p.getConnections(peerId)[0]
  if (connection) {
    console.log("already connected with Peer: ", peerId, connection)
  } else {
    console.log("dialing", addressStr)
    connection = await helia.libp2p.dial(address);
  }

  const latency = await helia.libp2p.services.ping.ping(address)
  console.log(`latency with Peer ${peerId}: `, latency)
  return connection
};