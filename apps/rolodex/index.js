import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { createAppNode, Agent, Runtime, connection, SERVER_RUNTIME, MessageCapability, StorageCapability, MembersRepository, CommunityRepository, Person } from 'account-fs/app.js';
import { generateNonce } from 'siwe';
import fs from 'node:fs/promises';
import { access, constants } from 'node:fs/promises';
import axios from 'axios';
import morgan from 'morgan';

const port = process.argv[2] || 3000;
const server = express();
server.use(morgan('tiny'))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.VITE_NETWORK || "DEVNET"
const COMMUNITY_AGENT_ACCESS_KEY = JSON.parse(process.env.VITE_COMMUNITY_AGENT_ACCESS_KEY) || ""
const RUN_COMMUNITY_AGENT = process.env.VITE_RUN_COMMUNITY_AGENT || true

// TODO mount filesystem
const helia = await createAppNode()

///
//Agent of Rolodex
// TODO - remove from git and generate for deployment
const runtimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'agent_runtime_config.json'), 'utf8'))
const runtime = new Runtime(SERVER_RUNTIME, runtimeConfig)
const agent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, runtime, "rolodex")
Object.assign(Agent.prototype, MessageCapability);

await agent.actAsRelationshipBroker()

const address = process.env.ROLODEX_DNS_MULTADDR_PREFIX ? process.env.ROLODEX_DNS_MULTADDR_PREFIX + await helia.libp2p.peerId.toString() : (await helia.libp2p.getMultiaddrs()[0].toString()) 

const brokerDID = await agent.accountDID()
await agent.setInbox(address)
console.log(address, await agent.DID(), brokerDID)

///
//Agent for Community
// set VITE_RUN_COMMUNITY_AGENT as false if you don't want this flow locally
var communityAgents = []
if (RUN_COMMUNITY_AGENT == true) {
  try {
    //check if config file exists
    await access(path.join(__dirname, "community_agent_runtime_config.json"), constants.R_OK | constants.W_OK);
    
    var communityRuntimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, "community_agent_runtime_config.json"), 'utf8'))
    //instantiate agent for each community in config file
    for (const [key, config] of Object.entries(communityRuntimeConfig)) {
      //add accessKey from envVar to runtime config
      let communityName = config.SHOVEL_ACCOUNT_HANDLE
      let communityAccountDID = config.SHOVEL_ACCOUNT_DID

      config.SHOVEL_FS_ACCESS_KEY = COMMUNITY_AGENT_ACCESS_KEY[communityAccountDID]
      console.log("accesskey picked up from env var :", communityName)
      
      //add forestCID from hub to runtime config
      const axios_client  = axios.create({
        baseURL: connection[NETWORK].sync_host,
      })  
      await axios_client.get(`/v1/accounts/${config.SHOVEL_ACCOUNT_DID}/head`).then(async (response) => {
        config.SHOVEL_FS_FOREST_CID = response.data.head
      })
      // create runtime
      const communityRuntime = new Runtime(SERVER_RUNTIME, config)
      var communityAgent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, communityRuntime, "rolodex")
      communityAgent = Object.assign(communityAgent, MessageCapability);
      communityAgent = Object.assign(communityAgent, StorageCapability);
      
      //load fs
      console.log("...bootstrapping agent for :", communityName)
      await communityAgent.bootstrap()
      console.log(`...loading filesystem for ${communityName}`)
      await communityAgent.load();
      console.log(`community Agent DID for ${communityName}:`, await communityAgent.DID())

      await communityAgent.setInbox(address)
      
      //initialise members repo
      var members = new MembersRepository(communityAgent)
      await members.initialise()
      
      //Run Join Approver fro community agent
      await communityAgent.actAsJoinApprover(communityAccountDID)
      communityAgents.push(communityAgent)
    }

    //start listeners for each agent
    communityAgents.forEach(async (agent) => {
      const communityRepo = new CommunityRepository(agent)
      let contact
      if (await communityRepo.isInitialised()) {
        contact = await communityRepo.contactForHandshake()
      } else {
        contact = await (new MembersRepository(agent)).contactForHandshake()
      }

      agent.approver.notification.addEventListener("challengeRecieved", async (challengeEvent) => {
        console.log("receieved from requester :", challengeEvent.detail)
        console.log("channel from event :", challengeEvent.detail.channelName)
        console.log("channel from agent :", agent.approver.channel.name)
        if (challengeEvent.detail.channelName == agent.approver.channel.name){
          var memberRepo = new MembersRepository(agent)
          let person = new Person(challengeEvent.detail.message.challenge.person)
          let valid = await person.validateProfileForCommunity(agent, communityRepo.sample().profileSchema, challengeEvent.detail.message.challenge.head)
          console.log("sending a valid profile? ", valid, challengeEvent.detail.message.challenge.person)
          if (valid) {
            await memberRepo.add(challengeEvent.detail.message.challenge.person)
            await challengeEvent.detail.confirm({person: contact}) 
          } else {
            await challengeEvent.detail.reject()  
          }
        } else {
          throw `Member Add on Join Handshake failed for ${agent.accountDID()}`
        }
      })
    })
  } catch (e){
    console.log(e)
  }
}

function joinFormOptionsForCommunity (communityRepo) {
  const community = communityRepo.sample()
  const schema = community.profileSchema
  return extractInputMap(schema) 
}

function extractInputMap(schema) {
  const inputsMap = {};

  if (schema.properties && schema.properties.inputs && schema.properties.inputs.properties) {
    const inputs = schema.properties.inputs.properties;

    for (const [key, value] of Object.entries(inputs)) {
      if (value.items && value.items.enum) {
        inputsMap[key] = {
          label: value.title || key,
          symbols: value.items.enum
        };
      }
    }
  }

  return inputsMap;
}

///
const communityRepo = new CommunityRepository()
const joinFormOptionsV1 = joinFormOptionsForCommunity(communityRepo)

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.get("/home", (req, res) => {
  res.render('pages/index')
});

server.get("/app", (req, res) => {
  res.render('pages/app', { brokerDID: brokerDID })
});

// Community Join link: community/{accountDID}/join?name=decentralised.co
server.get("/community/:accountDID/join", (req, res) => {
  res.render('pages/join', { communityDID: req.params.accountDID ,communityName: req.query.name })
});

// Community join form: community/{accountDID}/form?name=decentralised.co
server.get("/community/:accountDID/form", (req, res) => {
  res.render('pages/join_form', { communityDID: req.params.accountDID, communityName: req.query.name, options: joinFormOptionsV1, communityFile: JSON.stringify(communityRepo.sample()) })
});

server.get("/directory/:accountDID", (req, res) => {
  res.render('pages/directory', {communityDID: req.params.accountDID, communityName: req.query.name, optionsV1: joinFormOptionsV1})
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
