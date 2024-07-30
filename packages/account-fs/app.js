import { Agent, MessageCapability, StorageCapability, AccountCapability } from './agent/agent.js'
import { Runtime, SERVER_RUNTIME } from './agent/runtime.js'
import { MembersRepository } from './repository/members/members.js';
import { CommunityRepository } from './repository/members/community.ts';
import { createNode, APP } from './agent/helia_node.js';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { Person } from "./repository/people/person.ts";
//import { prometheusMetrics } from '@libp2p/prometheus-metrics'

async function createAppNode(blockPath, filePath) {
  const blockstore = new FsBlockstore(blockPath)
  const datastore = new FsDatastore(filePath)

  // const config = {metrics: prometheusMetrics()}
  const config = {}
  return await createNode(APP, blockstore, datastore, config)
}

const connection = {
  //"LOCAL": {network: "LOCAL"},
  "DEVNET": {network: "DEVNET", sync_host: "http://localhost:3000", dial_prefix: "/ip4/127.0.0.1/tcp/3001/ws/p2p/"},
  "TESTNET": {network: "TESTNET", sync_host: "https://testnet.shovel.company:8001", dial_prefix: "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/"}
}

export { Agent, Runtime, connection, createAppNode, SERVER_RUNTIME, MessageCapability, StorageCapability, AccountCapability, MembersRepository, CommunityRepository, Person }