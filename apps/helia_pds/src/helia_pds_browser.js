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
import { WnfsBlockstore, PrivateKey} from './helia_wnfs_blockstore_adaptor.js';
import { PublicDirectory, PrivateDirectory, PrivateForest, PrivateNode, AccessKey, receiveShare, Name, NameAccumulator } from "wnfs";
import { CID } from 'multiformats/cid'
import { toString, fromString } from 'uint8arrays';
import { createBrowserNode, dial } from './helia_node.js';
import { ExamplePublicFile } from './example_public_file.js';

var rootDirCID
var keypair

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
  window.keypair = keypair
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

async function acceptShare(node, recipientExchPrvKey, shareLabel, forestCid) {
  const wnfsBlockstore = new WnfsBlockstore(node)
  const rng = new Rng()
  const forest = await PrivateForest.load(CID.parse(forestCid).bytes, wnfsBlockstore)
  console.log("loaded forest:", forest)
  shareLabel = new Name(NameAccumulator.fromBytes(fromString(shareLabel, "base64url"))); 
  console.log("shareLabel:", shareLabel)
  const sharedNode = await receiveShare(
    shareLabel,
    recipientExchPrvKey,
    forest,
    wnfsBlockstore
  );
  window.sharedNode = sharedNode
  console.log("sharedNode:", sharedNode)

  const { rootDir } = await sharedNode.asDir().ls([], true, forest, wnfsBlockstore);
  console.log("rootDir:", rootDir)
  var privateFileContent = await rootDir.read(["private", "cats", "tabby.png"], true, forest, wnfsBlockstore)
  console.log(new TextDecoder().decode(privateFileContent.result))
}

export { dial, writeData, readFile, CID, writePrivateData, readPrivateFile, createExchangeRoot, acceptShare, createBrowserNode, ExamplePublicFile }