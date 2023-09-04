import { createHelia } from 'helia';
import { dagCbor } from '@helia/dag-cbor';
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { multiaddr } from 'multiaddr'
import { CID } from 'multiformats/cid'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { pingService } from 'libp2p/ping'
import { identifyService } from 'libp2p/identify'
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { keyToDID } from '@spruceid/didkit-wasm-node';
import { broadcast, eventProcessor } from './broadcast.js'

const port = 4001;

const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(cors());

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

const Registries = {}
/*
 head = {regID1to1from2: cid1
         regID1to2from1: cid2}
*/
const Heads = new Map();

//Node Setup
const node = await createNode()
const multiaddrs = node.libp2p.getMultiaddrs()
console.log("node address:", multiaddrs);
await node.libp2p.dial(multiaddr(process.argv[2]));
const dag = await dagCbor(node)

const topic = "events"

//event processor
node.libp2p.services.pubsub.addEventListener("message", async (evt) => {
  console.log(`evt read from topic: ${evt.detail.topic} :`, new TextDecoder().decode(evt.detail.data))
  await eventProcessor(dag, new TextDecoder().decode(evt.detail.data), Heads);
})
await node.libp2p.services.pubsub.subscribe(topic)

//console.log(dag.components.blockstore.bitswap);
const latency = await node.libp2p.services.ping.ping(multiaddr(process.argv[2]))
console.log("latency:", latency)

server.get("/", async (req, res) => {
  res.render('pages/index', {})
});

server.get("/cid/:id", async (req, res) => {
  var cid = CID.parse(req.params["id"])
  console.log(cid);
  var content = await dag.get(cid, {
    onProgress: (evt) => {
      console.info(evt.type, evt.detail)
    }
  })
  res.status(200).json(content)
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});

/*
sample re.body =
  {
    "name": "simple_follow_follow",
    "publickey": {"kty":"OKP","crv":"Ed25519","x":"EL_Z0oW6OLhN4Pe4LAzzGmOWkGZpxmhoqD0IAvQ4wGA"}
  }
  */
server.post("/registry", async (req, res) => {
  var registryDID = await createRegistry(req.body)
  console.log(`registry created with did ${registryDID}`)
  res.status(200).json({"did": registryDID})
})

/*
 sample req.body =
 {
   "registryID": "did:reg",
   "to": "did:a",
   "from": "did:b",
   "state": "requested",
   "sig": "hakjshdkjasnd"
 }
 */
server.post("/event", async (req, res) => {
  var CID = await addEvent(req.body)
  res.status(200).json({"cid": CID})
})

async function createRegistry(body) {
  var name = body.name
  var publickey = body.publickey
  var did = keyToDID('key', JSON.stringify(publickey))

  return did
}

async function addEvent (body) {
  var relID = `${body.regID}` + `${body.to}` + `${body.from}`
  var result
  if (Heads.has(relID)) {
    var CID = Heads.get(relID);
    console.log("Already_Present_CID:", CID)
    const object = { event: body, link: [CID] };
    const newCID = await dag.add(object);
    Heads.set(relID, newCID);
    console.log('newCID:', newCID)
    var head = await dag.get(newCID)
    console.log("head:", head)
    console.log("prev:", await dag.get(head.link))
    var result = newCID

  } else {
    const object = { event: body };
    const CID = await dag.add(object);
    Heads.set(relID, CID)
    console.log("set_CID", CID)
    console.log("first", await dag.get(CID))
    var result = CID
  }
  broadcast(node, topic, relID, result);
  return result
}

async function createNode () {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore()

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore()

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identifyService(),
      ping: pingService({ protocolPrefix: 'ipfs' }),
      pubsub: gossipsub({ allowPublishToZeroPeers: true })
    },
  })

  return await createHelia({
    datastore,
    blockstore,
    libp2p
  })
}
