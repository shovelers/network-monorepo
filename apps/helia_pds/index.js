import { createHelia } from 'helia';
import { bitswap } from 'helia/block-brokers'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { PublicDirectory, PrivateDirectory, PrivateForest } from "wnfs";
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { WnfsBlockstore, Rng } from './src/helia_wnfs_blockstore_adaptor.js';
import { CID } from 'multiformats/cid'

const node = await createNode()
const multiaddrs = node.libp2p.getMultiaddrs()
console.log("node address:", multiaddrs);

//Public Directory
const wnfsBlockstore = new WnfsBlockstore(node)
const dir = new PublicDirectory(new Date());
var { rootDir } = await dir.mkdir(["pictures", "cats"], new Date(), wnfsBlockstore);

var content = new TextEncoder().encode("Hello World 101")

var { rootDir } = await rootDir.write(
  ["pictures", "cats", "tabby.txt"],
  content,
  new Date(),
  wnfsBlockstore
);
console.log("root after write", rootDir)

var rootDirCID = await rootDir.store(wnfsBlockstore)
console.log("Public rootDirCID:", CID.decode(rootDirCID))

// List all files in /pictures directory.
var result  = await rootDir.ls(["pictures"], wnfsBlockstore);
console.log("existent test: ",result)

var fileContent = await rootDir.read(["pictures", "cats", "tabby.txt"], wnfsBlockstore)

console.log("Files Content:", new TextDecoder().decode(fileContent));

//Private Directory
const rng = new Rng()
const initialForest = new PrivateForest(rng)
console.log("initial forest: ", initialForest)
const privateDir = new PrivateDirectory(initialForest.emptyName(), new Date(), rng)
console.log("private dir: ", privateDir)

var { rootDir, forest } = await privateDir.mkdir(["private", "cats"], true, new Date(), initialForest, wnfsBlockstore, rng);

var privateContent = new TextEncoder().encode("Hello Private World 101")

var { rootDir, forest } = await rootDir.write(["private", "cats", "tabby.png"], true, privateContent, new Date(), forest, wnfsBlockstore, rng);

var privateRootDir = await rootDir.store(forest, wnfsBlockstore, rng)
var forestCid = await privateRootDir[1].store(wnfsBlockstore)
console.log("private root dir object: ", privateRootDir)
console.log("Access Key: ", privateRootDir[0].toBytes())
process.stdout.write(privateRootDir[0].toBytes() + '\n');
console.log("private forest CID: ", CID.decode(forestCid))


var privateResult  = await rootDir.ls(["private"], true, forest, wnfsBlockstore);
console.log("private ls: ", privateResult)

var privateFileContent = await rootDir.read(["private", "cats", "tabby.png"], true, forest, wnfsBlockstore)
console.log("private file content: ", new TextDecoder().decode(privateFileContent.result))

async function createNode () {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore()

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore()

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0/ws']
    },
    transports: [webSockets({filter: filters.all})],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: async (multiAddr) => {
        const str = multiAddr.toString()
        return !str.includes("/ws/") && !str.includes("/wss/") && !str.includes("/webtransport/")
      },
    },
    services: {
      identify: identify(),
      ping: ping({
        maxInboundStreams: 100,
        maxOutboundStreams: 100,
        runOnTransientConnection: false,
      }),
    },
  })
  
  
  return await createHelia({
    datastore,
    blockstore,
    libp2p,
    blockBrokers: [
      bitswap()
    ]
  })
}