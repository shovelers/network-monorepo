import { createNode, BROWSER } from './agent/helia_node.js';
import { AccountV1 } from './graph/account.js'
import { Agent, AccountCapability, StorageCapability, MessageCapability } from './agent/agent.js'
import { Runtime, BROWSER_RUNTIME } from './agent/runtime.js';
import { Person } from "./graph/repository/people/person.ts";
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

async function programInit(network) {
  //TODO check for network to be present in connection keys

  const helia = await createBrowserNode()

  const peers = await helia.libp2p.peerStore.all()
  for (let peer of peers) {
    await helia.libp2p.peerStore.delete(peer.id)
  }

  const runtime = new Runtime(BROWSER_RUNTIME, {})
  const agent =  new Agent(helia, connection[network].sync_host, connection[network].dial_prefix, runtime)
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

export { programInit, Person, AccountV1 }