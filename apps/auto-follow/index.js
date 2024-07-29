import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { createAppNode, Agent, Runtime, connection, SERVER_RUNTIME, MessageCapability, StorageCapability, AccountCapability, MembersRepository, CommunityRepository, Person } from 'account-fs/app.js';
import { generateNonce } from 'siwe';
import fs from 'node:fs/promises';
import { access, constants } from 'node:fs/promises';
import morgan from 'morgan';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";


const port = process.argv[2] || 3000;
const server = express();
server.use(morgan('tiny'))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.VITE_NETWORK || "DEVNET"
const RUN_COMMUNITY_AGENT = process.env.VITE_RUN_COMMUNITY_AGENT || true

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY|| 'DUMMY-KEY';
const client = new NeynarAPIClient(NEYNAR_API_KEY);

// TODO mount filesystem
const helia = await createAppNode()

///
//Agent of Rolodex
// TODO - remove from git and generate for deployment
const runtimeConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'agent_runtime_config.json'), 'utf8'))
const runtime = new Runtime(SERVER_RUNTIME, runtimeConfig)
const agent = new Agent(helia, connection[NETWORK].sync_host, connection[NETWORK].dial_prefix, runtime, "rolodex")
Object.assign(Agent.prototype, MessageCapability);

await agent.bootstrap()

await agent.actAsRelationshipBroker()

const address = process.env.ROLODEX_DNS_MULTADDR_PREFIX ? process.env.ROLODEX_DNS_MULTADDR_PREFIX + await helia.libp2p.peerId.toString() : (await helia.libp2p.getMultiaddrs()[0].toString()) 

const brokerDID = await agent.accountDID()
await agent.setInbox(address)
console.log(address, await agent.DID(), brokerDID)



server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))


// Community Join link: community/{accountDID}/join?name=decentralised.co

server.get("/auto_follow_signup", (req,res) => {
  res.render('pages/auto_follow_signup');
});

server.get("/auto_follow_landing", (req,res) => {
  res.render('pages/auto_follow_landing');
});


server.get('/nonce',  (req, res) => {
  const nonce = generateNonce();
  res.status(200).json(nonce);
});

server.get("/farcaster-following/:fid", async (req,res)  => {
  try {
    const response = await client.fetchUserFollowing(req.params.fid, {limit:50});
    const fidArray = response.result.users.map(user => user.fid);
    res.json(fidArray);
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

server.post("/farcaster-follow-users/",express.json(),  async (req, res) => {
  try {
      const { signerUuid, targetFids } = req.body;
      const response = await client.followUser(signerUuid,targetFids);
      res.status(200).json(response);
  }
  catch (error) {
    console.error("Error following users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
