import { createNode, BROWSER } from './agent/helia_node.js';
import { AccountV1 } from './account.js'
import { Agent, BROWSER_RUNTIME, AccountCapability, StorageCapability, MessageCapability, Runtime  } from './agent/agent.js'
import { PeopleSearch } from './repository/people/search.js'
import { PeopleRepository } from "./repository/people/people.ts";
import { Person } from "./repository/people/person.ts";
import { MembersRepository } from './repository/members/members.js';
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'

const connection = {
  //"LOCAL": {network: "LOCAL"},
  "DEVNET": {network: "DEVNET", sync_host: "http://localhost:3000", dial_prefix: "/ip4/127.0.0.1/tcp/3001/ws/p2p/"},
  "TESTNET": {network: "TESTNET", sync_host: "https://testnet.shovel.company:8001", dial_prefix: "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/"}
}

async function createBrowserNode() {
  const blockstore = new IDBBlockstore('blockstore/shovel')
  await blockstore.open()

  const datastore = new IDBDatastore('datastore/shovel')
  await datastore.open()

  return await createNode(BROWSER, blockstore, datastore)
}

async function programInit(network, appHandle) {
  //TODO check for network to be present in connection keys

  const helia = await createBrowserNode()

  const runtime = new Runtime(BROWSER_RUNTIME, {})
  const agent =  new Agent(helia, connection[network].sync_host, connection[network].dial_prefix, runtime, appHandle)
  Object.assign(Agent.prototype, AccountCapability);
  Object.assign(Agent.prototype, MessageCapability);
  Object.assign(Agent.prototype, StorageCapability);
  await agent.bootstrap()
  await agent.load()

  return  {
    helia: helia,
    agent: agent
  }
}

export { programInit, Person, PeopleRepository, AccountV1, MembersRepository, PeopleSearch }