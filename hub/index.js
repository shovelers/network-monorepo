import { CID } from 'multiformats/cid'
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStandaloneNode } from 'account-fs/hub.js';
import morgan from 'morgan';
import client from 'prom-client'
import { Key } from 'interface-datastore';
import { createClient } from 'redis';
import * as uint8arrays from 'uint8arrays';
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import { DIDKey } from 'iso-did/key'
import { SiweMessage } from 'siwe';

const redisURL = process.env.REDIS_URL || "redis://localhost:6379"
const redisClient =  createClient({ url: redisURL });
await redisClient.connect()

const port = process.argv[2] || 3000;
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

const homeDir = process.env.PROTOCOL_DB_HOME || path.join(__dirname, 'protocol_db')
await fs.mkdir(path.join(homeDir, 'blocks'), { recursive: true })
await fs.mkdir(path.join(homeDir, 'data'), { recursive: true })
const node = await createStandaloneNode(path.join(homeDir, 'blocks'), path.join(homeDir, 'data'))

const multiaddrs = node.libp2p.getMultiaddrs()
const peers = await node.libp2p.peerStore.all()
console.log("node address:", multiaddrs);
console.log("peers:", peers.length)

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
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const canPin = await accounts.validAgent(`${req.body.message.handle}#${req.body.message.signer}`)
  if (!canPin) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  var cid = CID.parse(req.body.message.cid)
  var handle = req.body.message.handle
  await node.datastore.put(new Key('/handle/' + handle), cid.bytes)
  var pin = node.pins.add(cid)
  console.log("pin", cid)
  res.status(201).json({})
});

// Todo - accountDID as primary key, move handles to separate naming layer
class Accounts {
  constructor(redis) {
    this.redis =  redis
  }

  async create(fullname) {
    await this.redis.sAdd("handles", fullname.split('#')[0])
    return await this.addAgent(fullname)
  }

  async createWithDID(accountDID, agentDID) {
    await this.redis.hSet(`account:${accountDID}`, 'id', accountDID)
    return await this.redis.sAdd(`agents:${accountDID}`, agentDID)
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

/*
   Registration

    body
        ▪ accountDID: did:pkh
        ▪ agentDID: did:key
        ▪ signed SIWE message, signed by did:pkh

    Response:
      {201, created: true/false}
*/
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
    await accounts.create(fullname)
    res.status(201).json({})
  }
});

server.post("/v1/accounts", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({})
    return
  }

  try {
    const siweMessage = new SiweMessage(req.body.message.siweMessage);
    const value = await siweMessage.verify({ signature: req.body.message.siweSignature });
    if (value.success && siweMessage.requestId == req.body.message.signer) {
      const accountDID = req.body.message.accountDID
      const agentDID = req.body.message.signer
      await accounts.createWithDID(accountDID, agentDID)
      res.status(201).json({ created: true })
    } else {
      res.status(400).json({ created: false })
    }
  } catch {
    res.status(400).json({ created: false })
  }
})

// Add Agent - change handle to accountDID
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

// Recovery
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

  var cid = await node.datastore.get(new Key('/handle/' + fullname.split('#')[0]))
  cid = CID.decode(cid)

  res.status(201).json({cid: cid.toString()})
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
  const numberOfDevices = await redisClient.sCard("accounts"); 
  //TODO : Change "accounts" to something more appropriate like active sessions in redis
  const numberOfAccounts = await redisClient.sCard("handles"); 

  res.render('pages/index', {
   
    agents : numberOfDevices,
    accounts: numberOfAccounts
  })
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});

process.on('warning', e => console.warn(e.stack));