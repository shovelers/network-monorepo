import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { createAppNode, Agent, Runtime, connection, SERVER_RUNTIME, MessageCapability, StorageCapability, MembersRepository } from 'account-fs/app.js';
import { generateNonce } from 'siwe';
import fs from 'node:fs/promises';
import { access, constants } from 'node:fs/promises';
import axios from 'axios';

const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.VITE_NETWORK || "DEVNET"
const COMMUNITY_AGENT_ACCESS_KEY = process.env.VITE_COMMUNITY_AGENT_ACCESS_KEY || ""
const RUN_COMMUNITY_AGENT = process.env.VITE_RUN_COMMUNITY_AGENT || true

// TODO mount filesystem
const helia = await createAppNode()

////
//Agent of Rolodex
// TODO - remove from git and generate for deployment
const runtimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'agent_runtime_config.json'), 'utf8'))
const runtime = new Runtime(SERVER_RUNTIME, runtimeConfig)
const agent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, runtime, "rolodex")
Object.assign(Agent.prototype, MessageCapability);

const appHandle = await agent.handle()
const broker = await agent.handle()
await agent.actAsRelationshipBroker()
///

///
//Agent for Community
// set VITE_RUN_COMMUNITY_AGENT as false if you don't want this flow locally
if (RUN_COMMUNITY_AGENT == true) {
  try {
    //check if config file exists
    await access(path.join(__dirname, "community_agent_runtime_config.json"), constants.R_OK | constants.W_OK);
    
    var communityRuntimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, "community_agent_runtime_config.json"), 'utf8'))
    //add accessKey from envVar to runtime config
    communityRuntimeConfig.SHOVEL_FS_ACCESS_KEY = COMMUNITY_AGENT_ACCESS_KEY
    //add forestCID from hub to runtime config
    const axios_client  = axios.create({
      baseURL: connection[NETWORK].sync_host,
    })  
    await axios_client.get(`/v1/accounts/${communityRuntimeConfig.SHOVEL_ACCOUNT_DID}/head`).then(async (response) => {
      communityRuntimeConfig.SHOVEL_FS_FOREST_CID = response.data.head
    })
    // create runtime
    const communityRuntime = new Runtime(SERVER_RUNTIME, communityRuntimeConfig)
    var communityAgent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, communityRuntime, "rolodex")
    communityAgent = Object.assign(communityAgent, MessageCapability);
    communityAgent = Object.assign(communityAgent, StorageCapability);
    
    //load fs
    console.log("...bootstrapping...")
    await communityAgent.bootstrap()
    console.log("...loading filesytem... ", communityAgent, communityAgent.runtime)
    console.log("...loading Credentials... ", await communityAgent.accountDID(), await communityAgent.forestCID(), await communityAgent.accessKey())
    await communityAgent.load();
    console.log("communityAgent DID :", await communityAgent.DID())
    
    //initialise members repo
    var members = new MembersRepository(communityAgent)
    await members.initialise()
    
    //Run Join Approver fro community agent
    const communityHandle = communityRuntimeConfig.SHOVEL_ACCOUNT_HANDLE
    await communityAgent.actAsJoinApprover(communityHandle)
    
    communityAgent.approver.notification.addEventListener("challengeRecieved", async (challengeEvent) => {
      // TODO Implementing auto-confim - check challenge to implement reject
      console.log("receieved from requester :", challengeEvent.detail)
      await members.add(challengeEvent.detail.message.challenge.person)

      // TODO save did and handle in DB/WNFS
      await challengeEvent.detail.confirm.call()
    })
  } catch (e){
    console.log(e)
    console.error("Not running Community Agent : No config file found")
  }
}
///

const address = process.env.ROLODEX_DNS_MULTADDR_PREFIX ? process.env.ROLODEX_DNS_MULTADDR_PREFIX + await helia.libp2p.peerId.toString() : (await helia.libp2p.getMultiaddrs()[0].toString()) 
const joinFormOptions = { 
  lookingFor: ["Gigs", "Job", "Partnerships", "Talent", "Warm Intros"],
  canHelpWith: ["Development", "Tokenomics", "Design", "Ideation", "GTM", "Testing", "Mentorship", "Fundraise", "Introductions"],
  expertise: ["Frames", "Full Stack", "Backend", "Frontend", "Design", "Data Analysis", "Smart Contracts", "Community", "Consumer Tech", "Social"]
}

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
  res.render('pages/join', { address: address, communityDID: req.params.accountDID ,communityName: req.query.name })
});

// Community join form: community/{accountDID}/form?name=decentralised.co
server.get("/community/:accountDID/form", (req, res) => { 
  res.render('pages/join_form', { address: address, communityDID: req.params.accountDID, communityName: req.query.name, options: joinFormOptions })
});

server.get("/directory/:accountDID", (req, res) => {
  res.render('pages/directory', {communityDID: req.params.accountDID, communityName: req.query.name, options: joinFormOptions})
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
