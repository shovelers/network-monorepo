import { dagCbor } from '@helia/dag-cbor';
import { CID } from 'multiformats/cid'
import { multiaddr } from 'multiaddr'
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { keyToDID } from '@spruceid/didkit-wasm-node';
import { broadcast, eventProcessor } from './event.js'
import { getRegistry, getFollowers, getFollowing} from './indexer.js'
import { createStandaloneNode } from 'account-fs/standalone.js';
import morgan from 'morgan';
import client from 'prom-client'
import { Key } from 'interface-datastore';
import { createClient } from 'redis';
import * as uint8arrays from 'uint8arrays';
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import { DIDKey } from 'iso-did/key'

const redisURL = process.env.REDIS_URL || "redis://localhost:6379"
const redisClient =  createClient({ url: redisURL });
await redisClient.connect()

const port = process.argv[2] || 3000;
const peer = process.argv[3];
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(cors());

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));
server.use(morgan('tiny'))

const Registries = new Array();
/*
 heads = {regID1to1from2: cid1
         regID1to2from1: cid2}
*/
const Heads = new Map();

//Node Setup

const homeDir = process.env.PROTOCOL_DB_HOME || path.join(__dirname, 'protocol_db')
await fs.mkdir(path.join(homeDir, 'blocks'), { recursive: true })
await fs.mkdir(path.join(homeDir, 'data'), { recursive: true })
const node = await createStandaloneNode(path.join(homeDir, 'blocks'), path.join(homeDir, 'data'))

const multiaddrs = node.libp2p.getMultiaddrs()
const peers = await node.libp2p.peerStore.all()
console.log("node address:", multiaddrs);
console.log("peers:", peers.length)

if (peer) {
  await node.libp2p.dial(multiaddr(peer));

  const latency = await node.libp2p.services.ping.ping(multiaddr(peer))
  console.log("latency:", latency)
};
const dag = await dagCbor(node)

//pubsub setup
const topic = "events"
//event processor
console.log("adding event processor...")
node.libp2p.services.pubsub.addEventListener("message", async (evt) => {
  console.log(`evt read from topic: ${evt.detail.topic} :`, new TextDecoder().decode(evt.detail.data))
  // await eventProcessor(dag, new TextDecoder().decode(evt.detail.data), Heads);
})
await node.libp2p.services.pubsub.subscribe(topic)
await node.libp2p.services.pubsub.subscribe("pras")
await node.libp2p.services.pubsub.subscribe("random")

server.get("/bootstrap", async (req, res) => {
  res.status(200).json({
    peerId: node.libp2p.peerId.toString(),
    peers: peers.length
  }) 
});

server.get("/metrics", async (req, res) => {
  res.write(await client.register.metrics());
  res.end();
})

async function verify(message, signature){
  const pubKey = DIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

server.post('/pin', async (req, res) => { 
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({})
    return
  }

  const canPin = await accounts.validAgent(`${req.body.message.handle}#${req.body.message.signer}`)
  if (!canPin) {
    res.status(401).json({})
    return
  }

  var cid = CID.parse(req.body.message.cid)
  var handle = req.body.message.handle
  await node.datastore.put(new Key('/handle/' + handle), cid.bytes)
  var pin = await node.pins.add(cid)
  console.log("pin", pin, cid)
  res.status(201).json({})
});

class Accounts {
  constructor(redis) {
    this.redis =  redis
  }

  async create(fullname) {
    await this.redis.sAdd("handles", fullname.split('#')[0])
    return await this.addAgent(fullname)
  }

  async addAgent(fullname) {
    return await this.redis.sAdd("accounts", fullname)
  }

  async taken(handle) {
    return await this.redis.sIsMember("handles", handle)
  }

  async validAgent(fullname) {
    return await this.redis.sIsMember("accounts", fullname)
  }
}
const accounts = new Accounts(redisClient)

server.post("/accounts", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({})
    return
  }

  var fullname = req.body.message.fullname
  const taken = await accounts.taken(fullname.split('#')[0])
  if (taken) {
    res.status(400).json({error: "User name taken"})
  } else {
    accounts.create(fullname)
    res.status(201).json({})
  }
});

server.put("/accounts/:handle/agents", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({})
    return
  }
  var agentDID = req.body.message.agentDID
  var fullname = `${req.params["handle"]}#${agentDID}`
  await accounts.addAgent(fullname)
  res.status(201).json({}) 
})

server.put("/accounts", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({})
    return
  }

  const kit = req.body.message.recoveryKit
  const verifyGeneratingAgent = await accounts.validAgent(kit.generatingAgent)
  if (!verifyGeneratingAgent) {
    res.status(401).json({})
    return
  }

  let message = {fullname: kit.generatingAgent, signer: kit.generatingAgent.split('#')[1]}
  const verifyKitSignature = await verify(message, kit.signature)
  if (!verifyKitSignature) {
    res.status(401).json({})
    return
  }

  var fullname = req.body.message.fullname
  await accounts.addAgent(fullname)
  res.status(201).json({})
});

server.get("/forestCID/:handle", async (req, res) => {
  try {
    var cid = await node.datastore.get(new Key('/handle/' + req.params["handle"]))
    cid = CID.decode(cid)
    res.status(200).json({cid: cid.toString()})
  } catch (error) {
    res.status(404).json({})
  }
});

server.get("/", async (req, res) => {
  res.render('pages/index', {
    registries: Registries.length,
    relationships: Heads.size
  })
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

server.get("/relationship", async (req, res) => {
  var relID = `${req.query.regID}` + `${req.query.to}` + `${req.query.from}`
  var headCID = Heads.get(relID)
  console.log("found the relationshipID:", headCID);
  if (headCID) {
    var content = await dag.get(headCID)

    res.status(200).json(content)
  }else {
    //to-do: manage case when head is missing, as relationship could exist but this node hasn't got any events yet
    res.status(400).json("not_found")
  }
});

server.get("/registry", async (req, res) => {
  var regID = `${req.query.regID}`
  var registry = await getRegistry(regID, Heads, dag)
  console.log("found registry:", registry);
  res.status(200).json(registry)
});

server.get("/registry/:regID/followers/:id", async (req, res) => {
  var regID = req.params["regID"]
  var id = req.params["id"]
  var registry = await getRegistry(regID, Heads, dag)
  var followers = getFollowers(registry, id)
  res.status(200).json(followers)
});

server.get("/registry/:regID/following/:id", async (req, res) => {
  var regID = req.params["regID"]
  var id = req.params["id"]
  var registry = await getRegistry(regID, Heads, dag)
  var following = getFollowing(registry, id)
  res.status(200).json(following)
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
  if (!Registries.includes(registryDID)) { Registries.push(registryDID) };
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
    console.log("prev:", await dag.get(head.link[0]))
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
  return result;
}