import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { createAppNode, Agent, Runtime, connection, SERVER_RUNTIME, MessageCapability } from 'account-fs/app.js';
import { generateNonce } from 'siwe';
import fs from 'node:fs/promises';

const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.VITE_NETWORK || "DEVNET"

// TODO mount filesystem
const helia = await createAppNode()

// TODO - remove from git and generate for deployment
const runtimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'agent_runtime_config.json'), 'utf8'))
const runtime = new Runtime(SERVER_RUNTIME, runtimeConfig)
const agent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, runtime, "rolodex")
Object.assign(Agent.prototype, MessageCapability);

const appHandle = await agent.handle()
await agent.actAsJoinApprover(appHandle)

agent.approver.notification.addEventListener("challengeRecieved", async (challengeEvent) => {
  // TODO Implementing auto-confim - check challenge to implement reject
  // TODO save did and handle in DB/WNFS
  await challengeEvent.detail.confirm.call()
})

const broker = await agent.handle()
await agent.actAsRelationshipBroker()

//Agent for Community
const communityRuntimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'community_agent_runtime_config.json'), 'utf8'))
const communityRuntime = new Runtime(SERVER_RUNTIME, communityRuntimeConfig)
var communityAgent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, communityRuntime, "rolodex")
communityAgent = Object.assign(communityAgent, MessageCapability);

const address = process.env.ROLODEX_DNS_MULTADDR_PREFIX ? process.env.ROLODEX_DNS_MULTADDR_PREFIX + await helia.libp2p.peerId.toString() : (await helia.libp2p.getMultiaddrs()[0].toString()) 

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index', { address: address, appHandle: appHandle })
});

server.get("/home", (req, res) => {
  res.render('pages/index', { address: address, appHandle: appHandle })
});

server.get("/app", (req, res) => {
  res.render('pages/app', { broker: broker, address: address })
});

server.get("/link", (req, res) => {
  res.render('pages/link', { username: req.query.username })
});

// Community Join link: community/{accountDID}/join?name=decentralised.co
server.get("/community/:accountDID/join", (req, res) => {
  res.render('pages/join', { address: address, appHandle: appHandle, communityName: req.query.name })
});

// Community join form: community/{accountDID}/form?name=decentralised.co
server.get("/community/:accountDID/form", (req, res) => {
  const options = {
    lookingFor: ["lf1", "lf2", "lf3"],
    interestedIn: ["iI1", "iI2", "iI3"],
    expertise: ["e1", "e2", "e3"]
  }
  res.render('pages/join_form', { address: address, appHandle: appHandle, communityName: req.query.name, options: options })
});

server.get("/directory", (req, res) => {
  res.render('pages/directory')
})

server.get('/nonce',  (req, res) => {
  const nonce = generateNonce();
  res.status(200).json(nonce);
});

server.get("/apple_contacts", async (req, res) => {
  try {
    const client = await createDAVClient({
      serverUrl: 'https://contacts.icloud.com',
      credentials: {
        username: req.query.username,
        password: req.query.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'carddav',
    });

    const addressBooks = await client.fetchAddressBooks();
    console.log(addressBooks);

    const vcards = await client.fetchVCards({
      addressBook: addressBooks[0],
    });

    console.log("Fetched " + vcards.length + " contacts for " + req.query.username + " successfully!")
    
    res.status(200).json(vcards)
  } catch (err) {
    console.log(err)
    res.status(400).
    json(err)
  } 
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
