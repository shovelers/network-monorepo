import { WnfsBlockstore, PrivateKey} from './helia_wnfs_blockstore_adaptor.js';
import { PublicDirectory, PrivateDirectory, PrivateForest, PrivateNode, AccessKey, receiveShare, Name, NameAccumulator } from "wnfs";
import { CID } from 'multiformats/cid'
import { toString, fromString } from 'uint8arrays';
import { createBrowserNode, dial } from './helia_node.js';
import { ExamplePublicFile } from './example_public_file.js';
import { ExamplePrivateFile } from './example_private_file.js';

var keypair

class Rng {
  randomBytes(count) {
    const array = new Uint8Array(count);
    self.crypto.getRandomValues(array);
    return array;
  }
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
  var privateFileContent = await rootDir.read(["private", "note.txt"], true, forest, wnfsBlockstore)
  console.log(new TextDecoder().decode(privateFileContent.result))
}

export { dial, createExchangeRoot, acceptShare, createBrowserNode, ExamplePublicFile, ExamplePrivateFile }