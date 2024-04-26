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

async function verify(message, signature){
  const pubKey = DIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

// Todo - accountDID as primary key, move handles to separate naming layer - Redo modelling
class Accounts {
  constructor(redis) {
    this.redis =  redis
  }

  async create(fullname) {
    await this.redis.sAdd("handles", fullname.split('#')[0])
    return await this.addAgent(fullname)
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

  async addAgent(fullname) {
    return await this.redis.sAdd("accounts", fullname)
  }

  async taken(handle) {
    return await this.redis.sIsMember("handles", handle)
  }

  async validAgent(fullname) {
    // TODO check for accountDID and agentDID    
    return await this.redis.sIsMember("accounts", fullname)
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

/*
  Storage APIs
*/
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
  await accounts.setHead(req.params.accountDID, req.body.message.cid)
  node.pins.add(CID.parse(req.body.message.cid)).then(() => { console.log("pin complete", req.params.accountDID, req.body.message.cid) })
  
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

server.get("/forestCID/:handle", async (req, res) => {
  try {
    var cid = await node.datastore.get(new Key('/handle/' + req.params["handle"]))
    cid = CID.decode(cid)
    res.status(200).json({cid: cid.toString()})
  } catch (error) {
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