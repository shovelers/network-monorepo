import { CID } from 'multiformats/cid'
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStandaloneNode } from 'account-fs/hub.js';
import morgan from 'morgan';
import client from 'prom-client'
import { createClient } from 'redis';
import * as uint8arrays from 'uint8arrays';
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import { DIDKey } from 'iso-did/key'
import { SiweMessage } from 'siwe';
import { car } from '@helia/car'
import { CarReader } from '@ipld/car'
import { Readable } from 'stream'

const redisURL = process.env.REDIS_URL || "redis://localhost:6379"
const redisClient =  createClient({ url: redisURL });
await redisClient.connect()

const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use((req, res, next) => {
  if (req.path.includes('/sync-car-file') && req.method === 'POST') {
    return next();
  }
  express.json()(req, res, next);
});
server.use(cors());

server.use(express.urlencoded({extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));
server.use(morgan('tiny'))

const homeDir = process.env.PROTOCOL_DB_HOME || path.join(__dirname, 'protocol_db')
await fs.mkdir(path.join(homeDir, 'blocks'), { recursive: true })
await fs.mkdir(path.join(homeDir, 'data'), { recursive: true })
const node = await createStandaloneNode(path.join(homeDir, 'blocks'), path.join(homeDir, 'data'))

const heliaCar = car({blockstore: node.blockstore, dagWalkers: node.pins.dagWalkers})
const multiaddrs = node.libp2p.getMultiaddrs()
const peers = await node.libp2p.peerStore.all()
console.log("node address:", multiaddrs);
console.log("peers:", peers.length)

async function verify(message, signature){
  const pubKey = DIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

class Accounts {
  constructor(redis) {
    this.redis =  redis
  }

// TODO - authz - ACL based agent list check - UCAN to switch to OCap - remove agents list
  async createOrAdd(accountDID, agentDID) {
    var registeredDID = await this.redis.hGet(`account:${accountDID}`, "id")
    if (registeredDID == accountDID) {
      await this.redis.sAdd(`agents:${accountDID}`, agentDID)
      return false
    } else {
      await this.redis.hSet(`account:${accountDID}`, 'id', accountDID)
      await this.redis.sAdd(`agents:${accountDID}`, agentDID)
      return true
    }
  }

  async exists(accountDID) {
    return await this.redis.exists(`agents:${accountDID}`)
  }

  async validAgentV1(accountDID, agentDID) {
    return await this.redis.sIsMember(`agents:${accountDID}`, agentDID)
  }

  async setHead(accountDID, cid){
    return await this.redis.hSet(`account:${accountDID}`, 'head', cid)
  }

  async getHead(accountDID){
    return await this.redis.hGet(`account:${accountDID}`, 'head')
  }

  async setInbox(accountDID, inbox){
    return await this.redis.hSet(`account:${accountDID}`, 'inbox', inbox)
  }

  async getInbox(accountDID){
    return await this.redis.hGet(`account:${accountDID}`, 'inbox')
  }

  async setAccessKey(accountDID, accessKey){
    return await this.redis.hSet(`account:${accountDID}`, 'accessKey', accessKey)
  }

  async getAccessKey(accountDID){
    return await this.redis.hGet(`account:${accountDID}`, 'accessKey')
  }

  async appendName(accountDID, name){
    let names = await this.getNames(accountDID)
    names = (names == null) ? name : names
    names = (names.split(',').includes(name)) ? names : `${names},${name}` 
    return await this.redis.hSet(`account:${accountDID}`, 'names', names)
  }

  async getNames(accountDID) {
    return await this.redis.hGet(`account:${accountDID}`, 'names')
  }

}
const accounts = new Accounts(redisClient)

/*
  Account APIs

   Registration

    body
        ▪ accountDID: did:pkh
        ▪ agentDID: did:key
        ▪ signed SIWE message, signed by did:pkh

    Response:
      {201, created: true/false}
*/
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
      const response = await accounts.createOrAdd(accountDID, agentDID)
      if (response) {
        res.status(201).json({ created: response })
      } else {
        const accessKey = await accounts.getAccessKey(accountDID) 
        const cid = await accounts.getHead(accountDID)
        res.status(200).json({ created: response, accessKey: accessKey, forestCID: cid })
      }
    } else {
      res.status(400).json({ created: false, msg: "SiweSignatureCheckFailed" })
    }
  } catch (error) {
    console.log(error)
    res.status(400).json({ created: false, msg: "ExceptionOnSIWE" })
  }
})

server.post("/v1/accounts/:accountDID/agents", async (req, res) => {
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
      const exists = await accounts.exists(accountDID)
      if (exists) {
        const response = await accounts.createOrAdd(accountDID, agentDID)
        const accessKey = await accounts.getAccessKey(accountDID) 
        const cid = await accounts.getHead(accountDID)
        res.status(200).json({ accessKey: accessKey, forestCID: cid })
      } else {
        res.status(404).json({ msg: "AccountMissing" })
      }
    } else {
      res.status(400).json({ created: false, msg: "SiweSignatureCheckFailed" })
    }
  } catch (error) {
    console.log(error)
    res.status(400).json({ created: false, msg: "ExceptionOnSIWE" })
  }
})

// Names
server.put("/v1/accounts/:accountDID/names", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const valid = await accounts.validAgentV1(req.params.accountDID, req.body.message.signer)
  if (!valid) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  // TODO enforce schema
  const name = `${req.body.message.id}@${req.body.message.provider}`
  await accounts.appendName(req.params.accountDID, name)
  res.status(201).json({})
})


server.get("/v1/accounts/:accountDID/names", async (req, res) => {
  const names = await accounts.getNames(req.params.accountDID)
  if (names) {
    res.status(200).json({names: names})
  } else {
    res.status(404).json({})
  }
});

// Custody
server.put("/v1/accounts/:accountDID/custody", async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const valid = await accounts.validAgentV1(req.params.accountDID, req.body.message.signer)
  if (!valid) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  const accessKey = req.body.message.accessKey
  await accounts.setAccessKey(req.params.accountDID, accessKey) 
  res.status(201).json({})
})

// Inbox
server.post('/v1/accounts/:accountDID/inbox', async (req, res) => { 
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const can = await accounts.validAgentV1(req.params.accountDID, req.body.message.signer)
  if (!can) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  await accounts.setInbox(req.params.accountDID, req.body.message.inbox)
  
  res.status(201).json({})
});

server.post('/v1/accounts/:accountDID/sync-car-file', express.json({ limit: '50mb'}), async (req, res) => {
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const can = await accounts.validAgentV1(req.params.accountDID, req.body.message.signer)
  if (!can) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  const readCarFileAndUpdateBlockstore = async (carBuffer) => {
    let buffer = Buffer.from(carBuffer, 'base64');
    const inStream = Readable.from(buffer);
    const reader = await CarReader.fromIterable(inStream);
    await heliaCar.import(reader);
  }
  await readCarFileAndUpdateBlockstore(req.body.message.carBuffer)
  accounts.setHead(req.params.accountDID, req.body.message.cid).then(() => {
    console.log("head updated after reading from car file")
  })
  res.status(201).json({})
});

server.get("/v1/accounts/:accountDID/inbox", async (req, res) => {
  const inbox = await accounts.getInbox(req.params.accountDID)
  if (inbox) {
    res.status(200).json({inbox: inbox})
  } else {
    res.status(404).json({})
  }
});

/*
  Storage APIs
*/

// TODO - authz - ACL based agent list check - UCAN to switch to OCap
server.post('/v1/accounts/:accountDID/head', async (req, res) => { 
  const verified = await verify(req.body.message, req.body.signature)
  if (!verified) {
    res.status(401).json({error: "InvalidSignature"})
    return
  }

  const canPin = await accounts.validAgentV1(req.params.accountDID, req.body.message.signer)
  if (!canPin) {
    res.status(401).json({error: "InvalidAgent"})
    return
  }

  // Possible failure scenario where head gets updated but block is not pinned
  node.pins.add(CID.parse(req.body.message.cid)).then(() => {
    console.log("pin complete", req.params.accountDID, req.body.message.cid)
    accounts.setHead(req.params.accountDID, req.body.message.cid).then(() => {
      console.log("head updated")
    })
  })
  
  res.status(201).json({})
});

server.get("/v1/accounts/:accountDID/head", async (req, res) => {
  const head = await accounts.getHead(req.params.accountDID)
  if (head) {
    res.status(200).json({head: head})
  } else {
    res.status(404).json({})
  }
});

/* 
  Network APIs
*/
server.get("/bootstrap", async (req, res) => {
  res.status(200).json({
    peerId: node.libp2p.peerId.toString(),
    peers: peers.length
  }) 
});

/*
  Admin APIs
*/
server.get("/metrics", async (req, res) => {
  res.write(await client.register.metrics());
  res.end();
})

server.get("/", async (req, res) => {
  let accountKeys = await redisClient.sendCommand(["keys","account:did*"])
  let numberOfAccounts = accountKeys.length

  let agentKeys = await redisClient.sendCommand(["keys","agents:did*"])
  let numberOfAgents = 0
  for (const key of agentKeys) {
    let count = await redisClient.sCard(key)
    numberOfAgents = numberOfAgents + count
  }

  res.render('pages/index', {
    agents : numberOfAgents,
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