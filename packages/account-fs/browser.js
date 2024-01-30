import { createBrowserNode } from './fs/helia_node.js';
import { AccountFS } from './fs/account_fs.js';
import { Account } from './agent/account.js'
import { AccountSession } from './agent/odd_session.js'

const connection = {
  "LOCAL": {network: "LOCAL"},
  "DEVNET": {network: "DEVNET", sync_host: "http://localhost:3000", dial_prefix: "/ip4/127.0.0.1/tcp/3001/ws/p2p/"},
  "TESTNET": {network: "TESTNET", sync_host: "https://testnet.shovel.company:8001", dial_prefix: "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/"}
}

async function programInit(network) {
  const helia = await createBrowserNode()

  const accountSession =  new AccountSession(helia, connection[network].sync_host)

  const accountfs = new AccountFS(helia, accountSession, connection[network].network, connection[network].sync_host)
  await accountfs.load()

  return  {
    helia: helia,
    fs: accountfs,
    session: accountSession
  }
}

export { Account, programInit }