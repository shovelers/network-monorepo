import { createHelia } from 'helia';
import { bitswap } from 'helia/block-brokers'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { multiaddr } from 'multiaddr'
import { WnfsBlockstore, PrivateKey} from './helia_wnfs_blockstore_adaptor.js';
import { PublicDirectory, PrivateDirectory, PrivateForest, PrivateNode, AccessKey, receiveShare } from "wnfs";
import { CID } from 'multiformats/cid'
import { toString } from 'uint8arrays';

var rootDirCID
var keypair

async function dial(node, peer) {
  const connection = await node.libp2p.dial(multiaddr(peer));
  const latency = await node.libp2p.services.ping.ping(multiaddr(peer))
  console.log("latency:", latency)
};

async function writeData(node, data) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  const dir = new PublicDirectory(new Date());
  var { rootDir } = await dir.mkdir(["pictures", "cats"], new Date(), wnfsBlockstore);

  var content = new TextEncoder().encode(data)

  var { rootDir } = await rootDir.write(
    ["pictures", "cats", "tabby.txt"],
    content,
    new Date(),
    wnfsBlockstore
  );
  console.log("root after write", rootDir)

  rootDirCID = await rootDir.store(wnfsBlockstore)
  window.rootDirCID = rootDirCID
  console.log("rootDirCID:", CID.decode(rootDirCID))
}

async function readFile(node, cid) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  console.log("passed cid: ",CID.parse(cid).bytes)
  console.log("rootDirCID: ",rootDirCID)
  if (await node.pins.isPinned(CID.parse(cid)) == false) {
    console.log("pinning rootCID")
    await node.pins.add(CID.parse(cid))
  }
  var rootDir = await PublicDirectory.load(CID.parse(cid).bytes ,wnfsBlockstore)
  console.log("loaded root:", rootDir)
  var fileContent = await rootDir.read(["pictures", "cats", "tabby.txt"], wnfsBlockstore)
  console.log("Files Content:", fileContent);
  return new TextDecoder().decode(fileContent)
}

class Rng {
  randomBytes(count) {
    const array = new Uint8Array(count);
    self.crypto.getRandomValues(array);
    return array;
  }
}

async function writePrivateData(node, data) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  const rng = new Rng()
  const initialForest = new PrivateForest(rng)
  const privateDir = new PrivateDirectory(initialForest.emptyName(), new Date(), rng)

  var { rootDir, forest } = await privateDir.mkdir(["private", "cats"], true, new Date(), initialForest, wnfsBlockstore, rng);

  var privateContent = new TextEncoder().encode(data)

  var { rootDir, forest } = await rootDir.write(["private", "cats", "tabby.png"], true, privateContent, new Date(), forest, wnfsBlockstore, rng);
  
  var privateDirResult = await rootDir.store(forest, wnfsBlockstore, rng)
  var forestCid = await privateDirResult[1].store(wnfsBlockstore)
  window.privateDirResult = privateDirResult
  window.accessKey = privateDirResult[0].toBytes()
  window.forestCid = forestCid
  return privateDirResult
}

async function readPrivateFile(node, accessKey, forestCid) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  const key = AccessKey.fromBytes(accessKey)
  const forest = await PrivateForest.load(forestCid, wnfsBlockstore)
  console.log("loaded forest:", forest)
  //load private node from PrivateForest using Access key
  var node = await PrivateNode.load(key, forest, wnfsBlockstore)
  console.log("loaded node:", node)
  window.loadedNode = node
  //load the node as_dir to get the rootDir 
  var rootDir = await node.asDir(forest, wnfsBlockstore)
  
  var privateFileContent = await rootDir.read(["private", "cats", "tabby.png"], true, forest, wnfsBlockstore)
  return new TextDecoder().decode(privateFileContent.result)
}

async function createExchangeRoot(node) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  keypair = await PrivateKey.generate();
  const excPubKey = await keypair.getPublicKey().getPublicKeyModulus()
  window.excPubKey = excPubKey

  const { rootDir } = await new PublicDirectory(new Date()).write(
    ["device1", "v1.exchange_key"],
    excPubKey,
    new Date(),
    wnfsBlockstore
  );

  const recipientExchRootCid = await rootDir.store(wnfsBlockstore);
  return [toString(excPubKey, 'base64url'), CID.decode(recipientExchRootCid).toString()]
};

async function acceptShare(node, recipientExchPrvKey, shareLabel) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  const rng = new Rng()
  const forest = new PrivateForest(rng); 
  const sharedNode = await receiveShare(
    shareLabel,
    recipientExchPrvKey,
    forest,
    wnfsBlockstore
  );
}

async function createHeliaNode() {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore()

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore()

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    transports: [webSockets({ filter: filters.all })],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: async (multiAddr) => {
        const str = multiAddr.toString()
        return !str.includes("/ws/") && !str.includes("/wss/") && !str.includes("/webtransport/")
      },
    },
    services: {
      ping: ping({
        maxInboundStreams: 100,
        maxOutboundStreams: 100,
        runOnTransientConnection: false,
      }),
      identify: identify(),
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

export { createHeliaNode, dial, writeData, readFile, CID, writePrivateData, readPrivateFile, createExchangeRoot, acceptShare}