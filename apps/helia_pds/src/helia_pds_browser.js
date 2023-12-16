import { WnfsBlockstore, PrivateKey, Rng} from './helia_wnfs_blockstore_adaptor.js';
import { PublicDirectory, PrivateDirectory, PrivateForest, PrivateNode, AccessKey, receiveShare, Name, NameAccumulator } from "wnfs";
import { CID } from 'multiformats/cid'
import { toString, fromString } from 'uint8arrays';
import { createBrowserNode, dial } from './helia_node.js';
import { ExamplePublicFile } from './example_public_file.js';
import { ExamplePrivateFile } from './example_private_file.js';

class Recipient {
  constructor(node) {
    this.store = new WnfsBlockstore(node)
  }

  async createExchangeRoot() {
    keypair = await PrivateKey.generate();
    const excPubKey = await keypair.getPublicKey().getPublicKeyModulus()

    const { rootDir } = await new PublicDirectory(new Date()).write(
      ["device1", "v1.exchange_key"],
      excPubKey,
      new Date(),
      this.store
    );

    const recipientExchRootCid = await rootDir.store(this.store);
   
    this.exchangeDir = rootDir
    this.exchRootCid = recipientExchRootCid
    this.keypair = keypair

    return [toString(excPubKey, 'base64url'), CID.decode(recipientExchRootCid).toString()]
  }

  async acceptShare(shareLabel, forestCID) {
    const rng = new Rng()
    const forest = await PrivateForest.load(CID.parse(forestCID).bytes, this.store)
    console.log("loaded forest:", forest)

    shareLabel = new Name(NameAccumulator.fromBytes(fromString(shareLabel, "base64url"))); 
    console.log("shareLabel:", shareLabel)

    const sharedNode = await receiveShare(
      shareLabel,
      this.keypair,
      forest,
      this.store
    );
    console.log("sharedNode:", sharedNode)
  
    const { rootDir } = await sharedNode.asDir().ls([], true, forest, this.store);
    console.log("rootDir:", rootDir)
    var privateFileContent = await rootDir.read(["private", "note.txt"], true, forest, this.store)
    console.log(new TextDecoder().decode(privateFileContent.result))
  }
}

export { dial, createBrowserNode, ExamplePublicFile, ExamplePrivateFile, Recipient }