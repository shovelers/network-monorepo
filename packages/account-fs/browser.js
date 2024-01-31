import { createBrowserNode } from './fs/helia_node.js';
import { AccountFS } from './fs/account_fs.js';
import { Account } from './agent/account.js'
import { Agent, BROWSER_RUNTIME, AccountCapability, StorageCapability, MessageCapability } from './agent/agent.js'

const connection = {
  //"LOCAL": {network: "LOCAL"},
  "DEVNET": {network: "DEVNET", sync_host: "http://localhost:3000", dial_prefix: "/ip4/127.0.0.1/tcp/3001/ws/p2p/"},
  "TESTNET": {network: "TESTNET", sync_host: "https://testnet.shovel.company:8001", dial_prefix: "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/"}
}

async function programInit(network) {
  //TODO check for network to be present in connection keys

  const helia = await createBrowserNode()

  const agent =  new Agent(helia, connection[network].sync_host, BROWSER_RUNTIME)
  Object.assign(Agent.prototype, AccountCapability);
  Object.assign(Agent.prototype, MessageCapability);
  Object.assign(Agent.prototype, StorageCapability);

  const accountfs = new AccountFS(helia, agent, connection[network].dial_prefix, connection[network].sync_host)
  await accountfs.load()

  return  {
    helia: helia,
    fs: accountfs,
    agent: agent
  }
}

export { Account, programInit }