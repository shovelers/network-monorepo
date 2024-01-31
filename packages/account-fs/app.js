import { AccountFS } from './fs/account_fs.js';
import { Account } from './agent/account.js'
import { Agent, SERVER_RUNTIME, MessageCapability } from './agent/agent.js'
import { createNode, APP } from './fs/helia_node.js';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
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

async function programInit(helia, network) {
  //TODO check for network to be present in connection keys
  
  const agent =  new Agent(helia, connection[network].sync_host, SERVER_RUNTIME)
  Object.assign(Agent.prototype, MessageCapability);

  const accountfs = new AccountFS(helia, agent, connection[network].dial_prefix, connection[network].sync_host)
  await accountfs.load()

  return  {
    helia: helia,
    fs: accountfs,
    agent: agent
  }
}

export { Agent, connection, createAppNode, SERVER_RUNTIME }


