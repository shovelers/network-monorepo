import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { createAppNode, Agent, Runtime, connection, SERVER_RUNTIME, MessageCapability, StorageCapability, MembersRepository, CommunityRepository, AccountV1, AppHandshakeApprover, CommunityHandshakeApprover } from 'account-fs/app.js';
import { generateNonce } from 'siwe';
import fs from 'node:fs/promises';
import { access, constants } from 'node:fs/promises';
import morgan from 'morgan';
import * as Sentry from "@sentry/node";

if (process.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
  });
} else {
  console.log("Skipping Sentry Initialization due to missing environment variable")
}

const port = process.argv[2] || 3000;
const server = express();
server.use(morgan('tiny'))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.VITE_NETWORK || "DEVNET"
const RUN_COMMUNITY_AGENT = process.env.VITE_RUN_COMMUNITY_AGENT || true

const configDir = process.env.CONFIG_HOME || __dirname
const homeDir = process.env.PROTOCOL_DB_HOME || path.join(__dirname, 'protocol_db')
await fs.mkdir(path.join(homeDir, 'blocks'), { recursive: true })
await fs.mkdir(path.join(homeDir, 'data'), { recursive: true })
const helia = await createAppNode(path.join(homeDir, 'blocks'), path.join(homeDir, 'data'))

///
//Agent of Rolodex
// TODO - remove from git and generate for deployment
const runtimeConfig = JSON.parse(await fs.readFile(path.join(configDir, 'agent_runtime_config.json'), 'utf8'))
const runtime = new Runtime(SERVER_RUNTIME, runtimeConfig)
const agent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, runtime)
Object.assign(agent, MessageCapability);
Object.assign(agent, StorageCapability);

await agent.bootstrap()

const address = process.env.ROLODEX_DNS_MULTADDR_PREFIX ? process.env.ROLODEX_DNS_MULTADDR_PREFIX + await helia.libp2p.peerId.toString() : (await helia.libp2p.getMultiaddrs()[0].toString()) 

const brokerDID = await agent.accountDID()
console.log(address, await agent.DID(), brokerDID)

const success = await agent.registerAgent(brokerDID, runtimeConfig.SHOVEL_AGENT_SIWE.message, runtimeConfig.SHOVEL_AGENT_SIWE.signature)
console.log("agent status", success)

if (success) {
  await agent.load()
  console.log(`Agent DID for rolodex:`, brokerDID)
} else {
  throw "Failed to register rolodex agent"
}

await agent.setInbox(address)

const account = new AccountV1(agent)
await account.loadRepositories()
await agent.approver.start()
await agent.broker.start()

agent.approver.register("JOIN", new AppHandshakeApprover(account.repositories))

///
//Agent for Community
// set VITE_RUN_COMMUNITY_AGENT as false if you don't want this flow locally
if (RUN_COMMUNITY_AGENT == true) {
  try {
    //check if config file exists
    await access(path.join(configDir, "community_agent_runtime_config.json"), constants.R_OK | constants.W_OK);
    
    var communityRuntimeConfig = JSON.parse(await fs.readFile(path.join(configDir, "community_agent_runtime_config.json"), 'utf8'))
    //instantiate agent for each community in config file
    for (const [key, config] of Object.entries(communityRuntimeConfig)) {
      //add accessKey from envVar to runtime config
      let communityName = config.SHOVEL_ACCOUNT_HANDLE
      let communityAccountDID = config.SHOVEL_ACCOUNT_DID

      // create runtime
      const communityRuntime = new Runtime(SERVER_RUNTIME, config)
      var communityAgent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, communityRuntime)
      communityAgent = Object.assign(communityAgent, MessageCapability);
      communityAgent = Object.assign(communityAgent, StorageCapability);
      
      const success = await communityAgent.registerAgent(communityAccountDID, config.SHOVEL_AGENT_SIWE.message, config.SHOVEL_AGENT_SIWE.signature)
      console.log("agent status", success, communityRuntime)

      if (success) {
        await communityAgent.load()
        console.log(`community Agent DID for ${communityName}:`, await communityAgent.DID())
      } else {
        console.log("Unable to load agent for community: ", communityName)
        continue
      }

      await communityAgent.setInbox(address)
      
      //initialise members repo
      var members = new MembersRepository(communityAgent)
      await members.initialise()
      
      const community = new CommunityRepository(communityAgent)

      communityAgent.approver.register("JOIN", new CommunityHandshakeApprover({community: community, members: members}, communityAgent))
      communityAgent.approver.start()
    }
  } catch (e){
    console.log(e)
  }
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

const communityRepo = new CommunityRepository()

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
  const communityDID = req.params.accountDID
  const communityFile = communityRepo.sample(communityDID)
  const joinFormOptionsV1 = extractInputMap(communityFile.profileSchema)
  res.render('pages/join_form', { communityDID: communityDID, communityName: req.query.name, options: joinFormOptionsV1, communityFile: JSON.stringify(communityFile) })
});

server.get("/directory/:accountDID", (req, res) => {
  const communityDID = req.params.accountDID
  const communityFile = communityRepo.sample(communityDID)
  const joinFormOptionsV1 = extractInputMap(communityFile.profileSchema)
  res.render('pages/directory', {communityDID: communityDID, communityName: req.query.name, optionsV1: joinFormOptionsV1, communityFile: JSON.stringify(communityFile) })
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
